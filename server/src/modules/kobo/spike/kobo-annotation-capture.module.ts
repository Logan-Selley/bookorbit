import { DynamicModule, Logger, Module } from '@nestjs/common';

import { isKoboAnnotationCaptureEnabled } from './kobo-capture.config';
import { KoboAnnotationCaptureController } from './kobo-annotation-capture.controller';
import { KoboCaptureSpikeGuard } from './kobo-capture-spike.guard';
import { KoboCaptureWriterService } from './kobo-capture-writer.service';
import { KoboReadingServicesProxyService } from './kobo-reading-services-proxy.service';

@Module({})
export class KoboAnnotationCaptureModule {
  private static readonly logger = new Logger(KoboAnnotationCaptureModule.name);

  static register(): DynamicModule {
    if (!isKoboAnnotationCaptureEnabled()) {
      return { module: KoboAnnotationCaptureModule };
    }

    this.logger.warn('KOBO_ANNOTATION_CAPTURE=1 — spike handlers registered (NOT for production)');

    return {
      module: KoboAnnotationCaptureModule,
      controllers: [KoboAnnotationCaptureController],
      providers: [KoboCaptureSpikeGuard, KoboReadingServicesProxyService, KoboCaptureWriterService],
      exports: [KoboReadingServicesProxyService],
    };
  }
}
