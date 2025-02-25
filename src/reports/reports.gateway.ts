import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ReportsService } from './reports.service';
import { OnModuleInit } from '@nestjs/common';
import { Report } from './entities/report.entity';
import { Interval } from '@nestjs/schedule';
import { startOfDay, endOfDay } from 'date-fns';
import { Between } from 'typeorm';

interface GateStats {
  onPremise: number;
  entry: number;
  exit: number;
  gateAccessStats: {
    allowed: number;
    allowedWithRemarks: number;
    notAllowed: number;
  };
  lastUpdated: Date;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ReportsGateway implements OnModuleInit, OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  private currentStats: GateStats = {
    onPremise: 0,
    entry: 0,
    exit: 0,
    gateAccessStats: {
      allowed: 0,
      allowedWithRemarks: 0,
      notAllowed: 0,
    },
    lastUpdated: new Date(),
  };

  constructor(private readonly reportsService: ReportsService) {}

  onModuleInit() {
    // Initialize stats when the server starts
    this.initializeStats();
  }

  handleConnection(client: Socket) {
    // Send current stats to newly connected client
    client.emit('stats-update', this.currentStats);
  }

  private async initializeStats() {
    this.currentStats = await this.calculateTodayStats();
    this.server?.emit('stats-update', this.currentStats);
  }

  @Interval(5000) // Update every 5 seconds
  async handleInterval() {
    const newStats = await this.calculateTodayStats();

    // Only emit if there are changes
    if (this.hasStatsChanged(newStats)) {
      this.currentStats = newStats;
      this.server.emit('stats-update', this.currentStats);
    }
  }

  private hasStatsChanged(newStats: GateStats): boolean {
    const oldStats = this.currentStats;
    return (
      oldStats.onPremise !== newStats.onPremise ||
      oldStats.entry !== newStats.entry ||
      oldStats.exit !== newStats.exit ||
      oldStats.gateAccessStats.allowed !== newStats.gateAccessStats.allowed ||
      oldStats.gateAccessStats.allowedWithRemarks !==
        newStats.gateAccessStats.allowedWithRemarks ||
      oldStats.gateAccessStats.notAllowed !==
        newStats.gateAccessStats.notAllowed
    );
  }

  private async calculateTodayStats(): Promise<GateStats> {
    const today = new Date();
    const todayReports = await this.reportsService.find({
      where: {
        datetime: Between(startOfDay(today), endOfDay(today)),
      },
      order: {
        datetime: 'DESC',
      },
    });

    const stats: GateStats = {
      onPremise: 0,
      entry: 0,
      exit: 0,
      gateAccessStats: {
        allowed: 0,
        allowedWithRemarks: 0,
        notAllowed: 0,
      },
      lastUpdated: new Date(),
    };

    todayReports.forEach((report: Report) => {
      // Count entries and exits
      if (report.type === '0') {
        stats.entry++;
      } else if (report.type === '1') {
        stats.exit++;
      }
    });

    // Calculate on-premise (entries minus exits)
    stats.onPremise = stats.entry - stats.exit;

    // Count access types
    const accessCounts = {
      green: 0,
      yellow: 0,
      red: 0,
    };

    todayReports.forEach((report: Report) => {
      if (report.remarks?.startsWith('GREEN')) accessCounts.green++;
      else if (report.remarks?.startsWith('YELLOW')) accessCounts.yellow++;
      else if (report.remarks?.startsWith('RED')) accessCounts.red++;
    });

    // Calculate percentages based on total on-premise
    const total = Math.max(stats.onPremise, 1); // Prevent division by zero
    stats.gateAccessStats = {
      allowed: Math.round((accessCounts.green / total) * 100),
      allowedWithRemarks: Math.round((accessCounts.yellow / total) * 100),
      notAllowed: Math.round((accessCounts.red / total) * 100),
    };

    return stats;
  }

  // Method to manually trigger stats recalculation
  async refreshStats() {
    await this.initializeStats();
  }
}
