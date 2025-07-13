
"use client";

import type { LogEntry, AppStatus } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Info, ListChecks, TriangleAlert } from "lucide-react";

interface StatusDisplayProps {
  logs: LogEntry[];
  status: AppStatus;
}

const StatusBadge: React.FC<{ status: AppStatus }> = ({ status }) => {
  switch (status) {
    case 'ok':
      return <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-sm py-1 px-3">OK</Badge>;
    case 'error':
      return <Badge variant="destructive" className="text-sm py-1 px-3">Error</Badge>;
    case 'idle':
    default:
      return <Badge variant="secondary" className="text-sm py-1 px-3">Idle</Badge>;
  }
};

const LogIcon: React.FC<{ type: LogEntry['type'] }> = ({ type }) => {
  switch (type) {
    case 'info':
      return <Info className="h-4 w-4 text-blue-500 shrink-0" />;
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />;
    case 'warning':
        return <TriangleAlert className="h-4 w-4 text-yellow-500 shrink-0" />;
    default:
      return <Info className="h-4 w-4 text-gray-500 shrink-0" />;
  }
};

export function StatusDisplay({ logs, status }: StatusDisplayProps) {

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-2xl">
          <ListChecks className="mr-2 h-6 w-6 text-primary" />
          Application Status &amp; Logs
        </CardTitle>
        <div className="flex items-center space-x-2 pt-2">
            <span className="text-sm text-muted-foreground">Current Status:</span>
            <StatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Operation Log</h3>
            <ScrollArea className="h-64 w-full rounded-md border p-4 bg-muted/30">
            {logs.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No log entries yet.</p>
            ) : (
                <div className="space-y-3">
                {logs.map((log) => (
                    <div key={log.id} className="flex items-start space-x-3 p-2 rounded-md hover:bg-background/50 transition-colors text-xs">
                        <LogIcon type={log.type} />
                        <div className="flex-1">
                            <p className="text-muted-foreground">
                            {new Date(log.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                            </p>
                            <p className={`leading-snug ${
                                log.type === 'error' ? 'text-destructive' : 
                                log.type === 'success' ? 'text-green-700' : 
                                log.type === 'warning' ? 'text-yellow-700' : 
                                'text-foreground/90'
                            }`}>
                            {log.message}
                            </p>
                        </div>
                    </div>
                ))}
                </div>
            )}
            </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
