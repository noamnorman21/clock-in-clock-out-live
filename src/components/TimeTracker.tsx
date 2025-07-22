import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, LogIn, LogOut, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
const SHEET_API_URL = "https://sheetdb.io/api/v1/rdfdnzyapz41b"; // החלף ב-URL שלך

interface TimeEntry {
  id: string;
  clockIn: Date;
  clockOut?: Date;
  duration?: number;
}
interface WorkSession {
  id: string;
  clockIn: string;
  clockOut: string;
  duration: number;
}

export const TimeTracker = () => {
  const [isWorking, setIsWorking] = useState(false);
  const [currentSession, setCurrentSession] = useState<TimeEntry | null>(null);
  const [workTime, setWorkTime] = useState(0);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const { toast } = useToast();
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");

  useEffect(() => {
    loadSessionsFromSheet();
  }, []);

  const loadSessionsFromSheet = async () => {
    try {
      const res = await fetch(SHEET_API_URL);
      const data = await res.json();

      type ApiEntry = {
        ID: string;
        Date: string;
        "Clock In": string;
        "Clock Out": string;
        "Duration (sec)": string;
      };

      // פונקציה שממירה תאריך וזמן מהגיליון לפורמט Date תקני
      const parseSheetDateTime = (dateStr: string, timeStr: string) => {
        if (!dateStr || !timeStr) return null;
        // תומך גם ב־/ וגם ב־.
        const [day, month, year] = dateStr.replace(/\./g, "/").split("/");
        if (!day || !month || !year) return null;
        // בונה פורמט תקני
        return new Date(
          `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${timeStr}`
        );
      };

      const parsedEntries: TimeEntry[] = (data as ApiEntry[])
        .map((entry) => ({
          id: entry.ID,
          clockIn: parseSheetDateTime(entry.Date, entry["Clock In"]),
          clockOut: parseSheetDateTime(entry.Date, entry["Clock Out"]),
          duration: parseInt(entry["Duration (sec)"], 10),
        }))
        .filter((e) => e.clockIn); // מסנן שורות לא תקינות

      setEntries(parsedEntries);
    } catch (err) {
      console.error("שגיאה בטעינת נתונים מהגיליון", err);
    }
  };

  const toDatetimeLocalValue = (date: Date): string => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60000);
    return localDate.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  };

  // פותח את חלון העריכה ומאתחל ערכים
  const openEditModal = (entry: TimeEntry) => {
    setEditEntry(entry);
    setEditClockIn(entry.clockIn ? toDatetimeLocalValue(entry.clockIn) : "");
    setEditClockOut(entry.clockOut ? toDatetimeLocalValue(entry.clockOut) : "");
  };

  // סוגר את חלון העריכה
  const closeEditModal = () => {
    setEditEntry(null);
    setEditClockIn("");
    setEditClockOut("");
  };

  // שליחת עדכון ל-SheetDB
  const updateEntryInSheet = async () => {
    if (!editEntry) return;
    try {
      // חישוב משך
      const clockInDate = new Date(editClockIn);
      const clockOutDate = new Date(editClockOut);
      const duration = Math.floor(
        (clockOutDate.getTime() - clockInDate.getTime()) / 1000
      );
      // פורמט תואם גיליון
      const formattedDate = clockInDate.toLocaleDateString("he-IL");
      const formattedClockIn = clockInDate.toLocaleTimeString("he-IL");
      const formattedClockOut = clockOutDate.toLocaleTimeString("he-IL");
      // SheetDB: עדכון לפי ID
      const payload = {
        data: [
          {
            ID: editEntry.id,
            Date: formattedDate,
            "Clock In": formattedClockIn,
            "Clock Out": formattedClockOut,
            "Duration (sec)": duration.toString(),
          },
        ],
      };
      const res = await fetch(`${SHEET_API_URL}/ID/${editEntry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast({ title: "עודכן בהצלחה!" });
        closeEditModal();
        loadSessionsFromSheet();
      } else {
        toast({ title: "שגיאה בעדכון", description: await res.text() });
      }
    } catch (err) {
      toast({ title: "שגיאת רשת", description: String(err) });
    }
  };

  // Update work time every second when working
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isWorking && currentSession) {
      interval = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor(
          (now.getTime() - currentSession.clockIn.getTime()) / 1000
        );
        setWorkTime(elapsed);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isWorking, currentSession]);

  const handleClockIn = () => {
    const now = new Date();
    const session: TimeEntry = {
      id: `session_${Date.now()}`,
      clockIn: now,
    };

    setCurrentSession(session);
    setIsWorking(true);
    setWorkTime(0);

    toast({
      title: "נכנסת לעבודה!",
      description: `התחלת לעבוד ב-${now.toLocaleTimeString("he-IL")}`,
    });
  };

  const handleClockOut = () => {
    if (!currentSession) return;

    const now = new Date();
    const duration = Math.floor(
      (now.getTime() - currentSession.clockIn.getTime()) / 1000
    );

    const completedEntry: TimeEntry = {
      ...currentSession,
      clockOut: now,
      duration,
    };

    const newEntries = [...entries, completedEntry];
    setEntries(newEntries);
    setCurrentSession(null);
    setIsWorking(false);
    setWorkTime(0);

    toast({
      title: "יצאת מהעבודה!",
      description: `עבדת ${formatDuration(duration)}`,
    });

    sendSessionToSheet({
      id: completedEntry.id,
      clockIn: completedEntry.clockIn.toISOString(),
      clockOut: now.toISOString(),
      duration,
    });
  };

  const sendSessionToSheet = async (session: WorkSession) => {
    const clockInDate = new Date(session.clockIn);
    const formattedDate = clockInDate.toLocaleDateString("he-IL"); // למשל: 22/07/2025
    const formattedClockIn = clockInDate.toLocaleTimeString("he-IL");
    const formattedClockOut = new Date(session.clockOut).toLocaleTimeString(
      "he-IL"
    );

    const payload = {
      data: [
        {
          ID: session.id,
          Date: formattedDate,
          "Clock In": formattedClockIn,
          "Clock Out": formattedClockOut,
          "Duration (sec)": session.duration.toString(),
        },
      ],
    };

    try {
      const res = await fetch(SHEET_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        console.log("✅ הסשן נשמר בגיליון בהצלחה");
      } else {
        const errorText = await res.text();
        console.error("❌ שגיאה בשליחה ל־Sheet:", errorText);
      }
    } catch (err) {
      console.error("❌ שגיאת רשת", err);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getTotalWorkTime = (): number => {
    return entries.reduce((total, entry) => total + (entry.duration || 0), 0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20 p-4 animate-fade-in">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-info bg-clip-text text-transparent">
            מערכת דיווח עבודה
          </h1>
          <p className="text-muted-foreground text-lg">
            עקוב אחרי שעות העבודה שלך בקלות ובדיוק
          </p>
        </div>

        {/* Current Status */}
        <Card className="p-8 text-center shadow-lg border-0 bg-card/80 backdrop-blur hover:shadow-xl transition-all duration-300">
          <div className="space-y-6">
            <div className="flex items-center justify-center space-x-2 rtl:space-x-reverse">
              <Clock className="w-8 h-8 text-primary" />
              <span className="text-2xl font-semibold">
                {isWorking ? "אתה עובד כרגע" : "לא עובד כרגע"}
              </span>
            </div>

            {isWorking && (
              <div className="space-y-2">
                <div className="text-6xl font-bold text-primary font-mono animate-pulse-gentle">
                  {formatDuration(workTime)}
                </div>
                <div className="text-muted-foreground">
                  התחלת לעבוד ב-
                  {currentSession && formatTime(currentSession.clockIn)}
                </div>
              </div>
            )}

            <div className="flex gap-4 justify-center">
              {!isWorking ? (
                <Button
                  onClick={handleClockIn}
                  variant="success"
                  size="xl"
                  className="min-w-[200px]"
                >
                  <LogIn className="w-6 h-6 ml-2" />
                  כניסה לעבודה
                </Button>
              ) : (
                <Button
                  onClick={handleClockOut}
                  variant="warning"
                  size="xl"
                  className="min-w-[200px]"
                >
                  <LogOut className="w-6 h-6 ml-2" />
                  יציאה מעבודה
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6 text-center bg-card/80 backdrop-blur border-0 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">
              היום
            </h3>
            <p className="text-3xl font-bold text-primary">
              {formatDuration(
                entries
                  .filter(
                    (entry) =>
                      entry.clockIn.toDateString() === new Date().toDateString()
                  )
                  .reduce((total, entry) => total + (entry.duration || 0), 0) +
                  (isWorking ? workTime : 0)
              )}
            </p>
          </Card>

          <Card className="p-6 text-center bg-card/80 backdrop-blur border-0 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">
              השבוע
            </h3>
            <p className="text-3xl font-bold text-info">
              {formatDuration(
                entries
                  .filter((entry) => {
                    const entryDate = entry.clockIn;
                    const now = new Date();
                    const weekStart = new Date(
                      now.getTime() - now.getDay() * 24 * 60 * 60 * 1000
                    );
                    return entryDate >= weekStart;
                  })
                  .reduce((total, entry) => total + (entry.duration || 0), 0) +
                  (isWorking ? workTime : 0)
              )}
            </p>
          </Card>

          <Card className="p-6 text-center bg-card/80 backdrop-blur border-0 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">
              סה״כ
            </h3>
            <p className="text-3xl font-bold text-success">
              {formatDuration(getTotalWorkTime() + (isWorking ? workTime : 0))}
            </p>
          </Card>
        </div>

        {/* Recent History */}
        {entries.length > 0 && (
          <Card className="p-6 bg-card/80 backdrop-blur border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="flex items-center space-x-2 rtl:space-x-reverse mb-4">
              <History className="w-5 h-5 text-primary" />
              <h3 className="text-xl font-semibold">היסטוריה אחרונה</h3>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {entries
                .slice(-10)
                .reverse()
                .map((entry) => (
                  <div
                    key={entry.id}
                    className="flex justify-between items-center p-3 bg-secondary/30 rounded-lg hover:bg-secondary/40 transition-colors duration-200"
                  >
                    <div className="text-right">
                      <div className="font-medium">
                        {formatDate(entry.clockIn)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatTime(entry.clockIn)} -{" "}
                        {entry.clockOut && formatTime(entry.clockOut)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-lg font-semibold text-primary">
                        {entry.duration && formatDuration(entry.duration)}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(entry)}
                      >
                        ערוך
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
            <Dialog
              open={!!editEntry}
              onOpenChange={(v) => !v && closeEditModal()}
            >
              <DialogContent className="max-w-[400px]">
                <DialogHeader>
                  <DialogTitle>עריכת דיווח</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="clockIn">שעת כניסה</Label>
                    <Input
                      id="clockIn"
                      type="datetime-local"
                      value={editClockIn}
                      onChange={(e) => setEditClockIn(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="clockOut">שעת יציאה</Label>
                    <Input
                      id="clockOut"
                      type="datetime-local"
                      value={editClockOut}
                      onChange={(e) => setEditClockOut(e.target.value)}
                    />
                  </div>
                </div>

                <DialogFooter className="mt-6">
                  <DialogClose asChild>
                    <Button variant="outline">ביטול</Button>
                  </DialogClose>
                  <Button
                    onClick={updateEntryInSheet}
                    disabled={!editClockIn || !editClockOut}
                  >
                    שמור
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Card>
        )}
      </div>
    </div>
  );
};
