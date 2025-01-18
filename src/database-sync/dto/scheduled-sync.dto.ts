export class ScheduledSyncDto {
  scheduleNumber: number;
  time: string;
  isActive: boolean;
  lastSyncTime: Date | null;
}
