/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BaseHttpRequest } from './core/BaseHttpRequest';
import type { OpenAPIConfig } from './core/OpenAPI';
import { FetchHttpRequest } from './core/FetchHttpRequest';
import { AuthService } from './services/AuthService';
import { ConfigurationsService } from './services/ConfigurationsService';
import { MilestonesService } from './services/MilestonesService';
import { ProjectsService } from './services/ProjectsService';
import { ReportsService } from './services/ReportsService';
import { ServiceService } from './services/ServiceService';
import { TestCasesService } from './services/TestCasesService';
import { TestRunsService } from './services/TestRunsService';
import { TestSuitesService } from './services/TestSuitesService';
type HttpRequestConstructor = new (config: OpenAPIConfig) => BaseHttpRequest;
export class TucanoApi {
  public readonly auth: AuthService;
  public readonly configurations: ConfigurationsService;
  public readonly milestones: MilestonesService;
  public readonly projects: ProjectsService;
  public readonly reports: ReportsService;
  public readonly service: ServiceService;
  public readonly testCases: TestCasesService;
  public readonly testRuns: TestRunsService;
  public readonly testSuites: TestSuitesService;
  public readonly request: BaseHttpRequest;
  constructor(config?: Partial<OpenAPIConfig>, HttpRequest: HttpRequestConstructor = FetchHttpRequest) {
    this.request = new HttpRequest({
      BASE: config?.BASE ?? 'http://localhost:3000',
      VERSION: config?.VERSION ?? '0.1.0',
      WITH_CREDENTIALS: config?.WITH_CREDENTIALS ?? false,
      CREDENTIALS: config?.CREDENTIALS ?? 'include',
      TOKEN: config?.TOKEN,
      USERNAME: config?.USERNAME,
      PASSWORD: config?.PASSWORD,
      HEADERS: config?.HEADERS,
      ENCODE_PATH: config?.ENCODE_PATH,
    });
    this.auth = new AuthService(this.request);
    this.configurations = new ConfigurationsService(this.request);
    this.milestones = new MilestonesService(this.request);
    this.projects = new ProjectsService(this.request);
    this.reports = new ReportsService(this.request);
    this.service = new ServiceService(this.request);
    this.testCases = new TestCasesService(this.request);
    this.testRuns = new TestRunsService(this.request);
    this.testSuites = new TestSuitesService(this.request);
  }
}

