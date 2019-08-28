import { ERC20ProxyContract, ERC20Wrapper } from '@0x/contracts-asset-proxy';
import { DummyERC20TokenContract } from '@0x/contracts-erc20';
import {
    blockchainTests,
    constants,
    describe,
    ERC20BalancesByOwner,
    expect,
    getLatestBlockTimestampAsync,
    hexConcat,
    increaseTimeAndMineBlockAsync,
    OrderFactory,
    OrderStatus,
    provider,
    txDefaults,
    web3Wrapper,
} from '@0x/contracts-test-utils';
import { BlockchainLifecycle } from '@0x/dev-utils';
import { RevertReason } from '@0x/types';
import { BigNumber } from '@0x/utils';
import * as _ from 'lodash';

import { DelegatorActor } from './actors/delegator_actor';
import { StakerActor } from './actors/staker_actor';
import { StakingWrapper } from './utils/staking_wrapper';
import { StakeStateId } from './utils/types';

// tslint:disable:no-unnecessary-type-assertion
blockchainTests.resets.only('Stake States', () => {
    // constants
    const ZRX_TOKEN_DECIMALS = new BigNumber(18);
    // tokens & addresses
    let accounts: string[];
    let owner: string;
    let stakers: string[];
    let zrxTokenContract: DummyERC20TokenContract;
    let erc20ProxyContract: ERC20ProxyContract;
    // wrappers
    let stakingWrapper: StakingWrapper;
    let erc20Wrapper: ERC20Wrapper;
    // tests
    before(async () => {
        // create accounts
        accounts = await web3Wrapper.getAvailableAddressesAsync();
        owner = accounts[0];
        stakers = accounts.slice(2, 5);
        // deploy erc20 proxy
        erc20Wrapper = new ERC20Wrapper(provider, accounts, owner);
        erc20ProxyContract = await erc20Wrapper.deployProxyAsync();
        // deploy zrx token
        [zrxTokenContract] = await erc20Wrapper.deployDummyTokensAsync(1, ZRX_TOKEN_DECIMALS);
        await erc20Wrapper.setBalancesAndAllowancesAsync();
        // deploy staking contracts
        stakingWrapper = new StakingWrapper(provider, owner, erc20ProxyContract, zrxTokenContract, accounts);
        await stakingWrapper.deployAndConfigureContractsAsync();
    });
    describe('Active Stake', () => {
        it('should return zero as initial stake', async () => {
            const staker = stakers[0];
            const balance = await stakingWrapper.getActiveStakeAsync(staker);
            expect(balance.current).to.be.bignumber.equal(new BigNumber(0));
            expect(balance.next).to.be.bignumber.equal(new BigNumber(0));
        });
        it('should successfully stake zero ZRX', async () => {
            const staker = stakers[0];
            const amount = StakingWrapper.toBaseUnitAmount(0);
            await stakingWrapper.stakeAsync(staker, amount);
            const balance = await stakingWrapper.getActiveStakeAsync(staker);
            expect(balance.current).to.be.bignumber.equal(amount);
            expect(balance.next).to.be.bignumber.equal(amount);
        });
        it('should successfully stake non-zero ZRX', async () => {
            const staker = stakers[0];
            const amount = StakingWrapper.toBaseUnitAmount(10);
            await stakingWrapper.stakeAsync(staker, amount);
            const balance = await stakingWrapper.getActiveStakeAsync(staker);
            expect(balance.current, 'current').to.be.bignumber.equal(amount);
            expect(balance.next, 'next').to.be.bignumber.equal(amount);
        });
        it('should retain active stake balance across epochs', async () => {
            const staker = stakers[0];
            const amount = StakingWrapper.toBaseUnitAmount(10);
            await stakingWrapper.stakeAsync(staker, amount);
            const initEpoch = await stakingWrapper.getCurrentEpochAsync();
            expect(initEpoch).to.be.bignumber.equal(new BigNumber(0));
            await stakingWrapper.goToNextEpochAsync();
            const finalEpoch = await stakingWrapper.getCurrentEpochAsync();
            expect(finalEpoch).to.be.bignumber.equal(new BigNumber(1));
            const balance = await stakingWrapper.getActiveStakeAsync(staker);
            expect(balance.current, 'current').to.be.bignumber.equal(amount);
            expect(balance.next, 'next').to.be.bignumber.equal(amount);
        });
    });
    describe('Inactive Stake', () => {
        it('should return zero as initial inactive', async () => {
            const staker = stakers[0];
            const balance = await stakingWrapper.getInactiveStakeAsync(staker);
            expect(balance.current).to.be.bignumber.equal(new BigNumber(0));
            expect(balance.next).to.be.bignumber.equal(new BigNumber(0));
        });
        it('should successfully deactivate zero stake', async () => {
            const staker = stakers[0];
            const amount = new BigNumber(0);
            await stakingWrapper.moveStakeAsync(staker, {id: StakeStateId.ACTIVE}, {id: StakeStateId.INACTIVE}, amount);
            const balance = await stakingWrapper.getInactiveStakeAsync(staker);
            expect(balance.current).to.be.bignumber.equal(new BigNumber(0));
            expect(balance.next).to.be.bignumber.equal(new BigNumber(0));
        });
        it('should successfully deactivate non-zero stake', async () => {
            const staker = stakers[0];
            const amountToStake = new BigNumber(10);
            const amountToDeactivate = new BigNumber(6);
            await stakingWrapper.stakeAsync(staker, amountToStake);
            await stakingWrapper.moveStakeAsync(staker, {id: StakeStateId.ACTIVE}, {id: StakeStateId.INACTIVE}, amountToDeactivate);
            // check active balance
            const activeBalance = await stakingWrapper.getActiveStakeAsync(staker);
            expect(activeBalance.current, 'active current').to.be.bignumber.equal(amountToStake);
            expect(activeBalance.next, 'active next').to.be.bignumber.equal(amountToStake.minus(amountToDeactivate));
            // check inactive balance
            const inactiveBalance = await stakingWrapper.getInactiveStakeAsync(staker);
            expect(inactiveBalance.current, 'inactive current').to.be.bignumber.equal(new BigNumber(0));
            expect(inactiveBalance.next, 'inactive next').to.be.bignumber.equal(amountToDeactivate);
        });
        /*
        it('should successfully stake zero ZRX', async () => {
            const staker = stakers[0];
            const amount = StakingWrapper.toBaseUnitAmount(0);
            await stakingWrapper.stakeAsync(staker, amount);
            const balance = await stakingWrapper.getActiveStakeAsync(staker);
            expect(balance.current).to.be.bignumber.equal(amount);
            expect(balance.next).to.be.bignumber.equal(amount);
        });
        it('should successfully stake non-zero ZRX', async () => {
            const staker = stakers[0];
            const amount = StakingWrapper.toBaseUnitAmount(10);
            await stakingWrapper.stakeAsync(staker, amount);
            const balance = await stakingWrapper.getActiveStakeAsync(staker);
            expect(balance.current, 'current').to.be.bignumber.equal(amount);
            expect(balance.next, 'next').to.be.bignumber.equal(amount);
        });
        it('should retain active stake balance across epochs', async () => {
            const staker = stakers[0];
            const amount = StakingWrapper.toBaseUnitAmount(10);
            await stakingWrapper.stakeAsync(staker, amount);
            const initEpoch = await stakingWrapper.getCurrentEpochAsync();
            expect(initEpoch).to.be.bignumber.equal(new BigNumber(0));
            await stakingWrapper.goToNextEpochAsync();
            const finalEpoch = await stakingWrapper.getCurrentEpochAsync();
            expect(finalEpoch).to.be.bignumber.equal(new BigNumber(1));
            const balance = await stakingWrapper.getActiveStakeAsync(staker);
            expect(balance.current, 'current').to.be.bignumber.equal(amount);
            expect(balance.next, 'next').to.be.bignumber.equal(amount);
        });
        */
    });

    /*
    describe('Unstake', () => {
        it('should successfully unstake zero ZRX', async () => {
            const staker = stakers[0];
            const amount = StakingWrapper.toBaseUnitAmount(0);
            await stakingWrapper.unstakeAsync(staker, amount);
            const balance = await stakingWrapper.getActiveStakeAsync(staker);
            expect(balance.current).to.be.bignumber.equal(amount);
            expect(balance.next).to.be.bignumber.equal(amount);
        });

        it('should successfully unstake non-zero ZRX', async () => {
            const staker = stakers[0];
            const amountToStake = StakingWrapper.toBaseUnitAmount(10);
            const amountToUnstake = StakingWrapper.toBaseUnitAmount(6);
            await stakingWrapper.stakeAsync(staker, amountToStake);
            await stakingWrapper.unstakeAsync(staker, amountToStake);
            // assert active stake
            const balance = await stakingWrapper.getActiveStakeAsync(staker);
            expect(balance.current, 'current').to.be.bignumber.equal(amount);
            expect(balance.next, 'next').to.be.bignumber.equal(amount);
            // assert
        });
        it('should retain active stake balance across epochs', async () => {
            const staker = stakers[0];
            const amount = StakingWrapper.toBaseUnitAmount(10);
            await stakingWrapper.stakeAsync(staker, amount);
            const initEpoch = await stakingWrapper.getCurrentEpochAsync();
            expect(initEpoch).to.be.bignumber.equal(new BigNumber(0));
            await stakingWrapper.goToNextEpochAsync();
            const finalEpoch = await stakingWrapper.getCurrentEpochAsync();
            expect(finalEpoch).to.be.bignumber.equal(new BigNumber(1));
            const balance = await stakingWrapper.getActiveStakeAsync(staker);
            expect(balance.current, 'current').to.be.bignumber.equal(amount);
            expect(balance.next, 'next').to.be.bignumber.equal(amount);
        });

    });
    */
});
// tslint:enable:no-unnecessary-type-assertion
