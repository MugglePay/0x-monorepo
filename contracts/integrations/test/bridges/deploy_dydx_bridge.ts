import { artifacts as assetProxyArtifacts, TestDydxBridgeContract } from '@0x/contracts-asset-proxy';
import { artifacts as ERC20Artifacts } from '@0x/contracts-erc20';
import { BlockchainTestsEnvironment } from '@0x/contracts-test-utils';

import { DeploymentManager } from '../framework/deployment_manager';

/**
 * Deploys test DydxBridge contract configured to work alongside the provided `deployment`.
 */
export async function deployDydxBridgeAsync(
    deployment: DeploymentManager,
    environment: BlockchainTestsEnvironment,
): Promise<TestDydxBridgeContract> {
    const dydxBridge = await TestDydxBridgeContract.deployFrom0xArtifactAsync(
        assetProxyArtifacts.TestDydxBridge,
        environment.provider,
        deployment.txDefaults,
        assetProxyArtifacts,
    );
    return dydxBridge;
}
