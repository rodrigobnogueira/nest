import { expect } from 'chai';
import * as sinon from 'sinon';
import { NestContainer } from '../../core/injector/container';
import { Injector, InjectorDependencyContext } from '../../core/injector/injector';
import { InstanceWrapper } from '../../core/injector/instance-wrapper';
import { Module } from '../../core/injector/module';
import { TestingInjector } from '../testing-injector';

describe('TestingInjector', () => {
  class TestModule {}
  class TestDependency {}

  let injector: TestingInjector;
  let container: NestContainer;
  let moduleRef: Module;
  let wrapper: InstanceWrapper;

  beforeEach(() => {
    injector = new TestingInjector({ preview: false });
    container = new NestContainer();
    moduleRef = new Module(TestModule, container);
    wrapper = new InstanceWrapper({
      name: TestDependency.name,
      token: TestDependency,
      instance: null,
      metatype: TestDependency,
      host: moduleRef,
    });
    injector.setContainer(container);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should set the mocker', () => {
    const mocker = sinon.stub().returns({});

    injector.setMocker(mocker);

    expect((injector as any).mocker).to.equal(mocker);
  });

  it('should set the container', () => {
    const otherContainer = new NestContainer();

    injector.setContainer(otherContainer);

    expect((injector as any).container).to.equal(otherContainer);
  });

  describe('resolveComponentWrapper', () => {
    it('should return the wrapper resolved by the parent injector', async () => {
      const expectedWrapper = new InstanceWrapper({
        name: 'resolved',
        token: 'resolved',
        instance: {},
        isResolved: true,
      });
      const dependencyContext: InjectorDependencyContext = {
        name: TestDependency,
      };
      const superResolveStub = sinon
        .stub(Injector.prototype, 'resolveComponentWrapper')
        .resolves(expectedWrapper as any);

      const result = await injector.resolveComponentWrapper(
        moduleRef,
        TestDependency,
        dependencyContext,
        wrapper,
      );

      expect(result).to.equal(expectedWrapper);
      expect(superResolveStub.calledOnce).to.be.true;
    });

    it('should fall back to mockWrapper when parent resolution fails', async () => {
      const dependencyContext: InjectorDependencyContext = {
        name: TestDependency,
      };
      const expectedWrapper = new InstanceWrapper({
        name: 'mocked',
        token: 'mocked',
        instance: {},
        isResolved: true,
      });
      const expectedError = new Error('missing dependency');
      sinon
        .stub(Injector.prototype, 'resolveComponentWrapper')
        .rejects(expectedError);
      const mockWrapperStub = sinon
        .stub(injector as any, 'mockWrapper')
        .resolves(expectedWrapper);

      const result = await injector.resolveComponentWrapper(
        moduleRef,
        TestDependency,
        dependencyContext,
        wrapper,
      );

      expect(result).to.equal(expectedWrapper);
      expect(
        mockWrapperStub.calledOnceWithExactly(
          expectedError,
          moduleRef,
          TestDependency,
          wrapper,
        ),
      ).to.be.true;
    });
  });

  describe('resolveComponentHost', () => {
    it('should return the wrapper resolved by the parent injector', async () => {
      const expectedWrapper = new InstanceWrapper({
        name: 'resolved',
        token: 'resolved',
        instance: {},
        isResolved: true,
      });
      const superResolveStub = sinon
        .stub(Injector.prototype, 'resolveComponentHost')
        .resolves(expectedWrapper as any);

      const result = await injector.resolveComponentHost(moduleRef, wrapper);

      expect(result).to.equal(expectedWrapper);
      expect(superResolveStub.calledOnce).to.be.true;
    });

    it('should fall back to mockWrapper when parent resolution fails', async () => {
      const expectedWrapper = new InstanceWrapper({
        name: 'mocked',
        token: 'mocked',
        instance: {},
        isResolved: true,
      });
      const expectedError = new Error('missing dependency');
      sinon.stub(Injector.prototype, 'resolveComponentHost').rejects(expectedError);
      const mockWrapperStub = sinon
        .stub(injector as any, 'mockWrapper')
        .resolves(expectedWrapper);

      const result = await injector.resolveComponentHost(moduleRef, wrapper);

      expect(result).to.equal(expectedWrapper);
      expect(
        mockWrapperStub.calledOnceWithExactly(
          expectedError,
          moduleRef,
          wrapper.name,
          wrapper,
        ),
      ).to.be.true;
    });
  });

  describe('mockWrapper', () => {
    it('should rethrow the original error when mocker is not set', async () => {
      const expectedError = new Error('missing dependency');

      try {
        await (injector as any).mockWrapper(
          expectedError,
          moduleRef,
          TestDependency,
          wrapper,
        );
        expect.fail('Expected mockWrapper to throw');
      } catch (err) {
        expect(err).to.equal(expectedError);
      }
    });

    it('should rethrow the original error when mocker returns a falsy value', async () => {
      const expectedError = new Error('missing dependency');
      injector.setMocker(() => undefined as any);

      try {
        await (injector as any).mockWrapper(
          expectedError,
          moduleRef,
          TestDependency,
          wrapper,
        );
        expect.fail('Expected mockWrapper to throw');
      } catch (err) {
        expect(err).to.equal(expectedError);
      }
    });

    it('should throw when the internal core module reference is missing', async () => {
      injector.setMocker(() => ({ mocked: true }));

      try {
        await (injector as any).mockWrapper(
          new Error('missing dependency'),
          moduleRef,
          TestDependency,
          wrapper,
        );
        expect.fail('Expected mockWrapper to throw');
      } catch (err) {
        expect((err as Error).message).to.equal(
          'Expected to have internal core module reference at this point.',
        );
      }
    });

    it('should register and return a mocked wrapper', async () => {
      const internalCoreModule = new Module(class InternalCoreModule {}, container);
      container.registerCoreModuleRef(internalCoreModule);
      const mockedInstance = { mocked: true };
      injector.setMocker(() => mockedInstance);

      const result = await (injector as any).mockWrapper(
        new Error('missing dependency'),
        moduleRef,
        TestDependency,
        wrapper,
      );

      expect(result).to.be.instanceOf(InstanceWrapper);
      expect(result.instance).to.equal(mockedInstance);
      expect(result.host).to.equal(moduleRef);
      expect(result.metatype).to.equal(wrapper.metatype);
      expect(internalCoreModule.providers.has(TestDependency)).to.be.true;
      expect(internalCoreModule.exports.has(TestDependency)).to.be.true;
      expect(internalCoreModule.providers.get(TestDependency)!.instance).to.equal(
        mockedInstance,
      );
    });
  });
});
