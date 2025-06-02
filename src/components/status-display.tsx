
"use client";

import type { FtpConfig, LogEntry, AppStatus, AppConfig } from "@/types"; // Added AppConfig
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Info, ListChecks, TriangleAlert, Server, FolderOpen } from "lucide-react"; // Added Server, FolderOpen
import { Separator } from "@/components/ui/separator";

interface StatusDisplayProps {
  config: FtpConfig | AppConfig | null; // Can now be AppConfig or old FtpConfig for flexibility
  logs: LogEntry[];
  status: AppStatus;
  isMonitoring: boolean;
}

const StatusBadge: React.FC<{ status: AppStatus; isMonitoring: boolean }> = ({ status, isMonitoring }) => {
  if (!isMonitoring && status !== 'error') {
    return <Badge variant="secondary" className="text-sm py-1 px-3">Idle</Badge>;
  }

  switch (status) {
    case 'monitoring':
      return <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-sm py-1 px-3">Monitoring</Badge>;
    case 'connecting':
      return <Badge variant="outline" className="border-blue-500 text-blue-500 text-sm py-1 px-3">Connecting...</Badge>;
    case 'transferring':
      return <Badge variant="outline" className="border-purple-500 text-purple-500 text-sm py-1 px-3">Processing...</Badge>;
    case 'success': // 'success' might refer to a specific folder poll, 'monitoring' for overall
      return <Badge variant="default" className="bg-accent hover:bg-accent/90 text-sm py-1 px-3">Activity Success</Badge>;
    case 'error':
      return <Badge variant="destructive" className="text-sm py-1 px-3">Error</Badge>;
    case 'configuring':
      return <Badge variant="secondary" className="text-sm py-1 px-3">Configuring...</Badge>;
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

export function StatusDisplay({ config, logs, status, isMonitoring }: StatusDisplayProps) {
  const isAppConfig = config && 'server' in config && 'folders' in config;
  const serverDetails = isAppConfig ? (config as AppConfig).server : config as FtpConfig | null;
  const monitoredFolders = isAppConfig ? (config as AppConfig).folders : [];

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-2xl">
          <ListChecks className="mr-2 h-6 w-6 text-primary" />
          Application Status & Configuration Overview
        </CardTitle>
        <div className="flex items-center space-x-2 pt-2">
            <span className="text-sm text-muted-foreground">Current Status:</span>
            <StatusBadge status={status} isMonitoring={isMonitoring} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {serverDetails && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground flex items-center"><Server className="mr-2 h-5 w-5 text-primary/80" /> Active Server Configuration</h3>
            <div className="p-4 border rounded-md bg-muted/30 text-sm space-y-2">
              <p><strong className="text-foreground/80">Host:</strong> <span className="font-mono text-foreground/90">{serverDetails.host}:{serverDetails.port}</span></p>
              <p><strong className="text-foreground/80">Username:</strong> <span className="font-mono text-foreground/90">{serverDetails.username}</span></p>
              <p><strong className="text-foreground/80">Root Local Path:</strong> <span className="font-mono text-foreground/90">{serverDetails.localPath}</span></p>
              
              {isAppConfig && monitoredFolders.length > 0 && (
                <>
                  <Separator className="my-3" />
                  <h4 className="text-md font-semibold text-foreground flex items-center"><FolderOpen className="mr-2 h-5 w-5 text-primary/70" /> Monitored Folders ({monitoredFolders.length})</h4>
                  <ScrollArea className="h-32 pr-2">
                  <ul className="space-y-1 list-disc list-inside pl-1">
                    {monitoredFolders.map(folder => (
                        <li key={folder.id} className="text-xs">
                            <span className="font-medium">{folder.name}</span>: <span className="font-mono">{folder.remotePath}</span> (Interval: {folder.interval}m)
                        </li>
                    ))}
                  </ul>
                  </ScrollArea>
                </>
              )}
              {!isAppConfig && (config as FtpConfig)?.remotePath && ( // Handle old FtpConfig structure if passed
                 <p><strong className="text-foreground/80">Remote Path (Legacy):</strong> <span className="font-mono text-foreground/90">{(config as FtpConfig).remotePath}</span></p>
              )}
            </div>
          </div>
        )}
        {!config && (
            <p className="text-muted-foreground">No configuration applied yet. Please set up the FTP details on the Configuration page.</p>
        )}
        
        <Separator />

        <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">FTP Operation Log</h3>
            <ScrollArea className="h-64 w-full rounded-md border p-4 bg-muted/30">
            {logs.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No FTP log entries yet.</p>
            ) : (
                <div className="space-y-3">
                {logs.map((log) => (
                    <div key={log.id} className="flex items-start space-x-3 p-2 rounded-md hover:bg-background/50 transition-colors text-xs">
                        <LogIcon type={log.type} />
                        <div className="flex-1">
                            <p className="text-muted-foreground">
                            {new Date(log.timestamp).toLocaleString()}
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

    