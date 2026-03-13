import { Injectable, Logger, LoggerService, Module as ModuleDecorator } from '@nestjs/common';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import { UuidFactory, UuidFactoryMode } from '@nestjs/core/inspector/uuid-factory';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { TestingModule } from '../testing-module';
import { TestingModuleBuilder } from '../testing-module.builder';

describe('TestingModuleBuilder', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should support override APIs and map overload metadata', () => {
    @Injectable()
    class PipeToken {}
    @Injectable()
    class FilterToken {}
    @Injectable()
    class GuardToken {}
    @Injectable()
    class InterceptorToken {}
    @Injectable()
    class ProviderToken {}
    @Injectable()
    class GuardClassOverride {}
    @ModuleDecorator({})
    class OriginalModule {}
    @ModuleDecorator({})
    class ReplacementModule {}

    const builder = new TestingModuleBuilder(new MetadataScanner(), {});
    const logger: LoggerService = {
      log: () => undefined,
      error: () => undefined,
      warn: () => undefined,
    };
    const mockFactory = sinon.stub().returns({ mock: true });
    const filterFactory = () => ({ fromFactory: true });
    const filterInject = ['token'];
    const pipeValue = { pipe: true };
    const interceptorValue = { interceptor: true };
    const providerValue = { provider: true };

    expect(builder.setLogger(logger)).to.equal(builder);
    expect(builder.useMocker(mockFactory)).to.equal(builder);
    expect(builder.overridePipe(PipeToken).useValue(pipeValue)).to.equal(builder);
    expect(
      builder.overrideFilter(FilterToken).useFactory({
        factory: filterFactory,
        inject: filterInject,
      }),
    ).to.equal(builder);
    expect(builder.overrideGuard(GuardToken).useClass(GuardClassOverride)).to.equal(
      builder,
    );
    expect(
      builder.overrideInterceptor(InterceptorToken).useValue(interceptorValue),
    ).to.equal(builder);
    expect(builder.overrideProvider(ProviderToken).useValue(providerValue)).to.equal(
      builder,
    );
    expect(
      builder.overrideModule(OriginalModule).useModule(ReplacementModule),
    ).to.equal(builder);

    const overloadsMap = (builder as any).overloadsMap as Map<any, any>;
    expect(overloadsMap.get(PipeToken)).to.deep.equal({
      useValue: pipeValue,
      isProvider: false,
    });
    expect(overloadsMap.get(FilterToken)).to.deep.equal({
      factory: filterFactory,
      inject: filterInject,
      useFactory: filterFactory,
      isProvider: false,
    });
    expect(overloadsMap.get(GuardToken)).to.deep.equal({
      useClass: GuardClassOverride,
      isProvider: false,
    });
    expect(overloadsMap.get(InterceptorToken)).to.deep.equal({
      useValue: interceptorValue,
      isProvider: false,
    });
    expect(overloadsMap.get(ProviderToken)).to.deep.equal({
      useValue: providerValue,
      isProvider: true,
    });
    expect((builder as any).mocker).to.equal(mockFactory);

    const moduleOverloads = (builder as any).getModuleOverloads();
    expect(moduleOverloads).to.deep.equal([
      {
        moduleToReplace: OriginalModule,
        newModule: ReplacementModule,
      },
    ]);
  });

  it('should apply overloads using container.replace', () => {
    @Injectable()
    class ProviderToken {}

    const builder = new TestingModuleBuilder(new MetadataScanner(), {});
    builder.overrideProvider(ProviderToken).useValue({ value: true });
    const replaceSpy = sinon.spy((builder as any).container, 'replace');

    (builder as any).applyOverloadsMap();

    expect(
      replaceSpy.calledOnceWithExactly(ProviderToken, {
        useValue: { value: true },
        isProvider: true,
      }),
    ).to.be.true;
  });

  it('should compile in snapshot mode and use deterministic UUID mode', async () => {
    @Injectable()
    class ProviderToken {}

    const builder = new TestingModuleBuilder(new MetadataScanner(), {
      providers: [ProviderToken],
    });
    const logger: LoggerService = {
      log: () => undefined,
      error: () => undefined,
      warn: () => undefined,
    };
    builder.setLogger(logger);
    builder.overrideProvider(ProviderToken).useValue({ fromOverride: true });

    const loggerSpy = sinon.spy(Logger, 'overrideLogger');
    const replaceSpy = sinon.spy((builder as any).container, 'replace');

    const moduleRef = await builder.compile({ snapshot: true, preview: true });

    expect(moduleRef).to.be.instanceOf(TestingModule);
    expect((UuidFactory as any)._mode).to.equal(UuidFactoryMode.Deterministic);
    expect(loggerSpy.called).to.be.true;
    expect(loggerSpy.firstCall.args[0]).to.equal(logger);
    expect(replaceSpy.called).to.be.true;

    await moduleRef.close();
  });

  it('should compile in non-snapshot mode and reset UUID mode to random', async () => {
    const builder = new TestingModuleBuilder(new MetadataScanner(), {});

    const moduleRef = await builder.compile();

    expect(moduleRef).to.be.instanceOf(TestingModule);
    expect((UuidFactory as any)._mode).to.equal(UuidFactoryMode.Random);

    await moduleRef.close();
  });
});
