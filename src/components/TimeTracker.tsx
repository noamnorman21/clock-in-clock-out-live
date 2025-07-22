import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Clock, LogIn, LogOut, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TimeEntry {
  id: string;
  clockIn: Date;
  clockOut?: Date;
  duration?: number;
}

export const TimeTracker = () => {
  const [isWorking, setIsWorking] = useState(false);
  const [currentSession, setCurrentSession] = useState<TimeEntry | null>(null);
  const [workTime, setWorkTime] = useState(0);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const { toast } = useToast();

  // Load data from localStorage on component mount
  useEffect(() => {
    const savedEntries = localStorage.getItem('timeEntries');
    const savedSession = localStorage.getItem('currentSession');
    const savedIsWorking = localStorage.getItem('isWorking');

    if (savedEntries) {
      const parsedEntries = JSON.parse(savedEntries).map((entry: any) => ({
        ...entry,
        clockIn: new Date(entry.clockIn),
        clockOut: entry.clockOut ? new Date(entry.clockOut) : undefined,
      }));
      setEntries(parsedEntries);
    }

    if (savedSession && savedIsWorking === 'true') {
      const session = JSON.parse(savedSession);
      setCurrentSession({
        ...session,
        clockIn: new Date(session.clockIn),
      });
      setIsWorking(true);
    }
  }, []);

  // Update work time every second when working
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isWorking && currentSession) {
      interval = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - currentSession.clockIn.getTime()) / 1000);
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

    // Save to localStorage
    localStorage.setItem('currentSession', JSON.stringify(session));
    localStorage.setItem('isWorking', 'true');

    toast({
      title: 'נכנסת לעבודה!',
      description: `התחלת לעבוד ב-${now.toLocaleTimeString('he-IL')}`,
    });
  };

  const handleClockOut = () => {
    if (!currentSession) return;

    const now = new Date();
    const duration = Math.floor((now.getTime() - currentSession.clockIn.getTime()) / 1000);
    
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

    // Save to localStorage
    localStorage.setItem('timeEntries', JSON.stringify(newEntries));
    localStorage.removeItem('currentSession');
    localStorage.setItem('isWorking', 'false');

    toast({
      title: 'יצאת מהעבודה!',
      description: `עבדת ${formatDuration(duration)}`,
    });
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('he-IL', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
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
                {isWorking ? 'אתה עובד כרגע' : 'לא עובד כרגע'}
              </span>
            </div>

            {isWorking && (
              <div className="space-y-2">
                <div className="text-6xl font-bold text-primary font-mono animate-pulse-gentle">
                  {formatDuration(workTime)}
                </div>
                <div className="text-muted-foreground">
                  התחלת לעבוד ב-{currentSession && formatTime(currentSession.clockIn)}
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
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">היום</h3>
            <p className="text-3xl font-bold text-primary">
              {formatDuration(
                entries
                  .filter(entry => 
                    entry.clockIn.toDateString() === new Date().toDateString()
                  )
                  .reduce((total, entry) => total + (entry.duration || 0), 0) +
                (isWorking ? workTime : 0)
              )}
            </p>
          </Card>

          <Card className="p-6 text-center bg-card/80 backdrop-blur border-0 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">השבוע</h3>
            <p className="text-3xl font-bold text-info">
              {formatDuration(
                entries
                  .filter(entry => {
                    const entryDate = entry.clockIn;
                    const now = new Date();
                    const weekStart = new Date(now.getTime() - (now.getDay() * 24 * 60 * 60 * 1000));
                    return entryDate >= weekStart;
                  })
                  .reduce((total, entry) => total + (entry.duration || 0), 0) +
                (isWorking ? workTime : 0)
              )}
            </p>
          </Card>

          <Card className="p-6 text-center bg-card/80 backdrop-blur border-0 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">סה״כ</h3>
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
                        {formatTime(entry.clockIn)} - {entry.clockOut && formatTime(entry.clockOut)}
                      </div>
                    </div>
                    <div className="text-lg font-semibold text-primary">
                      {entry.duration && formatDuration(entry.duration)}
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        )}

      </div>
    </div>
  );
};