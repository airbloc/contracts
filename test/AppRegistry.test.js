const { expect } = require('./test-utils');
const truffleAssert = require('truffle-assertions');
const AppRegistry = artifacts.require('AppRegistry');

contract('AppRegistry', async (accounts) => {
    const [me, stranger] = accounts;

    it('should register', async () => {
        const apps = await AppRegistry.new();

        const result = await apps.register('test-app');
        truffleAssert.eventEmitted(result, 'Registration', event => event.name === 'test-app');
    });

    it('should fail to register if the name duplicates', async () => {
        const apps = await AppRegistry.new();
        await apps.register('test-app');

        await truffleAssert.fails(
            apps.register('test-app'),
            truffleAssert.ErrorType.REVERT, 'already exists',
        );
    });

    it('should able to get registered app data', async () => {
        const apps = await AppRegistry.new();
        await apps.register('test-app');

        const app = await apps.get('test-app');
        expect(app.name).to.equal('test-app');
        expect(app.owner).to.equal(me);
    });

    it('should able to check existance', async () => {
        const apps = await AppRegistry.new();
        await apps.register('test-app');

        await expect(apps.exists('test-app')).to.eventually.be.true;
        await expect(apps.exists('wrong-test-app')).to.eventually.be.false;
    });

    it('should able to transfer ownership', async () => {
        const apps = await AppRegistry.new();
        await apps.register('test-app');

        const result = await apps.transferAppOwner('test-app', stranger);
        truffleAssert.eventEmitted(result,
            'AppOwnerTransferred',
            event => event.newOwner === stranger,
        );

        const app = await apps.get('test-app');
        expect(app.owner).to.equal(stranger);
    });

    it('should fail to transfer ownership if it is not by the owner', async () => {
        const apps = await AppRegistry.new();
        await apps.register('test-app');

        await truffleAssert.fails(
            apps.transferAppOwner('test-app', stranger, {from: stranger}),
            truffleAssert.ErrorType.REVERT,
        );
    });


    it('should unregister', async () => {
        const apps = await AppRegistry.new();
        await apps.register('test-app');

        const result = await apps.unregister('test-app');
        truffleAssert.eventEmitted(result, 'Unregistration', event => event.name === 'test-app');
    });

    it('should fail to unregister if it is not by the owner', async () => {
        const apps = await AppRegistry.new();
        await apps.register('test-app');

        await truffleAssert.fails(
            apps.unregister('test-app', {from: stranger}),
            truffleAssert.ErrorType.REVERT, 'unauthorized',
        );
    });
});
