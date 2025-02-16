import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { UnprocessableEntityException } from '@nestjs/common';
import { Response } from 'express';
import { Report } from './entities/report.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: ReportsService;

  const mockReportsService = {
    findAll: jest.fn(),
    searchContains: jest.fn(),
    findByDateRange: jest.fn(),
    create: jest.fn(),
    generateCSVReport: jest.fn(),
    cleanupFile: jest.fn(),
    findByType: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: mockReportsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ReportsController>(ReportsController);
    service = module.get<ReportsService>(ReportsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all reports', async () => {
      const result = [{ id: '1', name: 'Test Report' }] as unknown as Report[];
      jest.spyOn(service, 'findAll').mockResolvedValue(result as any);

      expect(await controller.findAll()).toBe(result);
    });
  });

  describe('searchContains', () => {
    it('should throw error if search string is too short', () => {
      expect(() => controller.searchContains('ab')).toThrow(
        UnprocessableEntityException,
      );
    });

    it('should return filtered reports', async () => {
      const result = [{ id: '1', name: 'Test Report' }] as unknown as Report[];
      jest.spyOn(service, 'searchContains').mockResolvedValue(result as any);

      expect(await controller.searchContains('test')).toBe(result);
    });
  });

  describe('findByDateRange', () => {
    it('should throw error for invalid date format', () => {
      expect(() => controller.findByDateRange('invalid', '2024-03-20')).toThrow(
        UnprocessableEntityException,
      );
    });

    it('should return reports within date range', async () => {
      const result = [
        { id: '1', datetime: '2024-03-20' },
      ] as unknown as Report[];
      jest.spyOn(service, 'findByDateRange').mockResolvedValue(result as any);

      expect(await controller.findByDateRange('2024-03-19', '2024-03-20')).toBe(
        result,
      );
    });
  });

  describe('generateCSV', () => {
    it('should generate and download CSV', async () => {
      const mockResponse = {
        download: jest.fn(),
      } as unknown as Response;

      jest.spyOn(service, 'generateCSVReport').mockResolvedValue({
        filePath: 'path/to/file',
        fileName: 'report.csv',
      });

      await controller.generateCSV(mockResponse);
      expect(mockResponse.download).toHaveBeenCalled();
    });
  });

  describe('findByType', () => {
    it('should return reports of specified type', async () => {
      const result = [{ id: '1', type: '0' }] as unknown as Report[];
      jest.spyOn(service, 'findByType').mockResolvedValue(result as any);

      expect(await controller.findByType('0')).toBe(result);
    });
  });
});
