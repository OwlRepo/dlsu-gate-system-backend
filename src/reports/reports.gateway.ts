import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ReportsService } from './reports.service';
import { OnModuleInit, Logger } from '@nestjs/common';
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
  path: '/socket.io/',
  transports: ['websocket', 'polling'], // Explicitly define transports
})
export class ReportsGateway
  implements
    OnModuleInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ReportsGateway.name);
  private isPollingActive = true;
  private connectedClients = 0;
  private lastSuccessfulUpdate: Date = new Date();
  private readonly FALLBACK_THRESHOLD = 10000; // 10 seconds in milliseconds

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

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
  }

  async onModuleInit() {
    try {
      await this.initializeStats();
      this.logger.log('Initial stats calculated successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize stats: ${error.message}`);
    }
  }

  handleConnection(client: Socket) {
    this.connectedClients++;
    this.logger.log(
      `Client connected: ${client.id}. Total clients: ${this.connectedClients}`,
    );

    try {
      client.emit('stats-update', this.currentStats);
    } catch (error) {
      this.logger.error(
        `Error sending initial stats to client ${client.id}: ${error.message}`,
      );
    }
  }

  handleDisconnect(client: Socket) {
    this.connectedClients--;
    this.logger.log(
      `Client disconnected: ${client.id}. Total clients: ${this.connectedClients}`,
    );
  }

  private async initializeStats() {
    try {
      this.currentStats = await this.calculateTodayStats();
      if (this.server?.sockets?.sockets?.size > 0) {
        this.server.emit('stats-update', this.currentStats);
        this.logger.debug('Stats broadcast to all clients');
      }
    } catch (error) {
      this.logger.error(`Failed to initialize stats: ${error.message}`);
      throw error;
    }
  }

  @Interval(parseInt(process.env.POLLING_INTERVAL) || 1000)
  async handleInterval() {
    if (!this.isPollingActive || this.connectedClients === 0) {
      return;
    }

    try {
      const newStats = await this.calculateTodayStats();

      if (this.hasStatsChanged(newStats)) {
        this.currentStats = newStats;
        this.server.emit('stats-update', this.currentStats);
        this.logger.debug('Stats updated and broadcast to clients');
        this.lastSuccessfulUpdate = new Date();
      }
    } catch (error) {
      this.logger.error(`Error during stats polling: ${error.message}`);
      this.server.emit('stats-error', { message: 'Failed to update stats' });
    }
  }

  @Interval(10000) // Run every 10 seconds
  async fallbackRefresh() {
    if (this.connectedClients === 0) {
      return;
    }

    const timeSinceLastUpdate =
      Date.now() - this.lastSuccessfulUpdate.getTime();

    if (timeSinceLastUpdate >= this.FALLBACK_THRESHOLD) {
      this.logger.warn(
        `No successful updates in ${timeSinceLastUpdate}ms, triggering fallback refresh`,
      );
      try {
        const success = await this.refreshStats();
        if (success) {
          this.lastSuccessfulUpdate = new Date();
          this.logger.log('Fallback refresh successful');
        }
      } catch (error) {
        this.logger.error(`Fallback refresh failed: ${error.message}`);
      }
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
    let todayReports: Report[] = [];

    try {
      todayReports = await this.reportsService.find({
        where: {
          datetime: Between(startOfDay(today), endOfDay(today)),
        },
        order: {
          datetime: 'DESC',
        },
      });
    } catch (error) {
      this.logger.error(`Failed to fetch reports: ${error.message}`);
      throw new Error(`Database query failed: ${error.message}`);
    }

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
      if (report.type === '1') {
        stats.entry++;
      } else if (report.type === '2') {
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
      if (report.status?.startsWith('GREEN')) accessCounts.green++;
      else if (report.status?.startsWith('YELLOW')) accessCounts.yellow++;
      else if (report.status?.startsWith('RED')) accessCounts.red++;
    });

    stats.gateAccessStats = {
      allowed:
        stats.entry === 0
          ? 0
          : Math.round((accessCounts.green / todayReports.length) * 100),
      allowedWithRemarks:
        stats.entry === 0
          ? 0
          : Math.round((accessCounts.yellow / todayReports.length) * 100),
      notAllowed:
        stats.entry === 0
          ? 0
          : Math.round((accessCounts.red / todayReports.length) * 100),
    };

    return stats;
  }

  // Method to manually trigger stats recalculation
  async refreshStats() {
    try {
      await this.initializeStats();
      this.logger.log('Stats refreshed successfully');
      return true;
    } catch (error) {
      this.logger.error(`Failed to refresh stats: ${error.message}`);
      return false;
    }
  }

  // Health check method
  async checkHealth(): Promise<boolean> {
    try {
      await this.calculateTodayStats();
      return true;
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      return false;
    }
  }
}
