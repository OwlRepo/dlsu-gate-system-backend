import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Report } from './entities/report.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Response } from 'express';

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
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: mockReportsService,
        },
        {
          provide: getRepositoryToken(Report),
          useValue: {
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
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
      const result = ['test'];
      jest.spyOn(service, 'findAll').mockImplementation(() => result as any);

      expect(await controller.findAll()).toBe(result);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('searchContains', () => {
    it('should search reports with given string', async () => {
      const searchString = 'test';
      const result = ['test'];
      jest
        .spyOn(service, 'searchContains')
        .mockImplementation(() => result as any);

      expect(await controller.searchContains(searchString)).toBe(result);
      expect(service.searchContains).toHaveBeenCalledWith(searchString);
    });
  });

  describe('findByDateRange', () => {
    it('should find reports within date range', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      const result = ['test'];
      jest
        .spyOn(service, 'findByDateRange')
        .mockImplementation(() => result as any);

      expect(await controller.findByDateRange(startDate, endDate)).toBe(result);
      expect(service.findByDateRange).toHaveBeenCalledWith(startDate, endDate);
    });
  });

  describe('create', () => {
    it('should create a new report', async () => {
      const createReportDto = { title: 'Test Report' };
      const result = { id: 1, ...createReportDto };
      jest.spyOn(service, 'create').mockImplementation(() => result as any);

      expect(await controller.create(createReportDto)).toBe(result);
      expect(service.create).toHaveBeenCalledWith(createReportDto);
    });
  });

  describe('generateCSV', () => {
    it('should generate and download CSV report', async () => {
      const mockResponse = {
        download: jest.fn((path, name, cb) => cb()),
      } as unknown as Response;

      const mockResult = {
        filePath: '/tmp/report.csv',
        fileName: 'report.csv',
      };

      jest.spyOn(service, 'generateCSVReport').mockResolvedValue(mockResult);
      jest
        .spyOn(service, 'cleanupFile')
        .mockImplementation(() => Promise.resolve());

      await controller.generateCSV(mockResponse);

      expect(service.generateCSVReport).toHaveBeenCalled();
      expect(mockResponse.download).toHaveBeenCalledWith(
        mockResult.filePath,
        mockResult.fileName,
        expect.any(Function),
      );
      expect(service.cleanupFile).toHaveBeenCalledWith(mockResult.filePath);
    });

    it('should handle download errors', async () => {
      const mockResponse = {
        download: jest.fn((path, name, cb) => cb(new Error('Download failed'))),
      } as unknown as Response;

      const mockResult = {
        filePath: '/tmp/report.csv',
        fileName: 'report.csv',
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      jest.spyOn(service, 'generateCSVReport').mockResolvedValue(mockResult);
      jest
        .spyOn(service, 'cleanupFile')
        .mockImplementation(() => Promise.resolve());

      await controller.generateCSV(mockResponse);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error downloading file:',
        expect.any(Error),
      );
      expect(service.cleanupFile).toHaveBeenCalledWith(mockResult.filePath);

      consoleSpy.mockRestore();
    });
  });
});
