import { Tables } from 'fortigate-autoscale-core/db-definitions';
import {Firestore, FieldValue} from '@google-cloud/firestore';
import * as AutoScaleCore from 'fortigate-autoscale-core';
import Compute from '@google-cloud/compute';
import {Storage} from '@google-cloud/storage';
import { CloudPlatform, LicenseRecord } from 'fortigate-autoscale-core';
import {AutoscaleHandler} from 'fortigate-autoscale-core/autoscale-handler';
import * as Platform from 'fortigate-autoscale-core/cloud-platform';
import { URL } from 'url';

const {
    FIRESTORE_DATABASE,
    ASSET_STORAGE_NAME ,
    FORTIGATE_PSK_SECRET,
    TRIGGER_URL,
    PROJECT_ID,
    SCRIPT_TIMEOUT,

} = process.env,
SCRIPT_EXECUTION_TIME_CHECKPOINT = Date.now();

namespace GCPPlatform {
    export interface Filter {
        Name: string;
        Value: string;
    }

    export interface NetworkInterface {
        NetworkInterfaceId: string;
    }

    // tslint:disable-next-line: no-empty-interface
    export interface CreateNetworkInterfaceRequest {}

    export interface Vpc {
        VpcId: string;
    }

    export interface Subnet {
        VpcId: string;
        SubnetId: string;
    }

    export interface Instance {
        instanceId: string;
        PrivateIpAddress: string;
        PublicIpAddress: string;
        SubnetId: string;
        VpcId: string;
    }
}
interface GCPVirtualMachineDescriptor
    extends AutoScaleCore.VirtualMachineLike,
        GCPPlatform.Instance {
            InstanceId: string;
            PrivateIpAddress: string;
            PublicIpAddress: string;
            SubnetId: string;
            VpcId: string;
        }

export interface GCPNetworkInterface
    extends AutoScaleCore.NetworkInterfaceLike,
        GCPPlatform.NetworkInterface {}
class GCPVirtualMachine extends AutoScaleCore.VirtualMachine<
    GCPVirtualMachineDescriptor,
    GCPNetworkInterface
> {

    constructor(o: GCPVirtualMachineDescriptor) {
        super(o.InstanceId, o.scalingGroupName || null, 'gcp', o as GCPVirtualMachineDescriptor);

    }

    get primaryPrivateIpAddress() {

        return this.sourceData.PrivateIpAddress;
    }

    get primaryPublicIpAddress() {
        return this.sourceData.PublicIpAddress;
    }

    get subnetId() {
        return this.sourceData.SubnetId;
    }

    get virtualNetworkId() {
        return this.sourceData.VpcId;
    }
}
export class GCPRuntimeAgent extends AutoScaleCore.RuntimeAgent<
    GCPPlatformRequest,
    GCPPlatformContext,
    Console
>   {
    public body: any;
    public instance: any;
    public headers: GCPRuntimeAgent;
    public respond(response: AutoScaleCore.ErrorDataPairLike): Promise<any> {
        throw new Error('Method not implemented.');
    }
    public async processResponse(response): Promise<string> {
        return 'processed response string as return';
    }
}

// tslint:disable-next-line: no-empty-interface
export interface GCPPlatformRequest extends AutoScaleCore.HttpRequest {}

export interface GCPPlatformContext {

}

export interface GCPNameValuesPair extends GCPPlatform.Filter {
}
export interface HttpRequest extends Platform.HttpRequestLike {
    httpMethod(): Platform.HttpMethodType;
}
interface GCPBlobStorageItemDescriptor extends AutoScaleCore.BlobStorageItemDescriptor {
    storageName: string;
    keyPrefix: string;
    fileName?: string;
}
class GCP extends CloudPlatform<
        GCPPlatformRequest,
        GCPPlatformContext,
        Console,
        GCPNameValuesPair,
        GCPVirtualMachineDescriptor,
        GCPVirtualMachine,
        GCPRuntimeAgent
        > {

    public logger = new AutoScaleCore.Functions.DefaultLogger(console);
    public compute = new Compute();
    public blobStorage = new Storage({
        projectId: PROJECT_ID,
    });
    private fireStoreClient = new Firestore();

    public respond(response: AutoScaleCore.ErrorDataPairLike, httpStatusCode?: number): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public describeScalingGroup(decriptor: AutoScaleCore.ScalingGroupDecriptor): Promise<AutoScaleCore.ScalingGroupLike> {
        throw new Error('Method not implemented.');
    }

    public getTgwVpnAttachmentRecord(_selfInstance: GCPVirtualMachine) {
        throw new Error('Method not implemented.');
    }

    public async getSettingItems(keyFilter?: string[], valueOnly?: boolean) {
        let item;
        let settingItem: AutoScaleCore.SettingItem;
        const fireStoreDocument = this.fireStoreClient.doc(`${FIRESTORE_DATABASE}/SETTINGS`);
        try {
            const getDoc: any = await fireStoreDocument.get();
            const formattedItems: AutoScaleCore.SettingItems = {};
            const filteredItems: AutoScaleCore.SettingItems = {};

            if (getDoc && getDoc._fieldsProto
                ) {
                    console.log('Getting Setting Items.');
                    // tslint:disable-next-line: forin
                    for (item in getDoc._fieldsProto) {
                        // An empty String in FireStore counts as undefined
                        if (!item.mapValue) {
                            settingItem =
                            new AutoScaleCore.SettingItem(
                                item,
                                getDoc._fieldsProto[item].mapValue.fields.settingValue.stringValue,
                                getDoc._fieldsProto[item].mapValue.fields.editable.booleanValue,
                                getDoc._fieldsProto[item].mapValue.fields.jsonEncoded.booleanValue,
                                getDoc._fieldsProto[item].mapValue.fields.description.stringValue,
                            );
                            formattedItems[item] = settingItem;
                            filteredItems[item] = settingItem;
                        } else {
                            settingItem =
                            new AutoScaleCore.SettingItem(
                                item,
                                getDoc._fieldsProto[item].mapValue.fields.settingValue.stringValue,
                                getDoc._fieldsProto[item].mapValue.fields.editable.booleanValue,
                                getDoc._fieldsProto[item].mapValue.fields.jsonEncoded.booleanValue,
                                getDoc._fieldsProto[item].mapValue.fields.description.stringValue,
                            );
                            formattedItems[item] = settingItem;
                            filteredItems[item] = settingItem;
                        }
                    }
                    this.__settings = formattedItems;
                    this._initialized = true;
                    return keyFilter && filteredItems || formattedItems;
            }

        } catch (err) {
            console.log('Error Getting Setting Items', err);
            throw err;
        }
        throw console.error('Could Not Retreive Setting items. From Firestore');
}

    public getLicenseFileContent(descriptor: AutoScaleCore.BlobStorageItemDescriptor): Promise<string> {
        throw new Error('Method not implemented.');
    }
    // No DB initilization needed. Return true,
    // DB settings handled in the autoscale handler init
    public async init(): Promise<boolean> {
        return true;
    }

    public async getAllAutoScaleInstanceIds() {
        console.log('Called AutoScaler');
        const getAutoscaler = await this.compute.getAutoscalers();
        return getAutoscaler;
    }
    // Get config file from Storage and return as object
    public async getBlobFromStorage(
        parameters: GCPBlobStorageItemDescriptor,
    ) {
        console.log('Getting Config From Blob Storage');
        const files = await this.blobStorage.bucket(parameters.storageName);
        const file = files.file(parameters.fileName);
        const fileData = {content: (await file.download()).toString()};
        return fileData;
    }
    public async putMasterRecord(candidateInstance: GCPVirtualMachine,
                                 voteState: AutoScaleCore.MasterElection.VoteState,
                                 method: AutoScaleCore.MasterElection.VoteMethod): Promise<boolean> {
        console.log('Updating Master Record Database', candidateInstance);
        const datetoInt = Date.now();
        const masterUpdateClient = this.fireStoreClient;
        const document = masterUpdateClient.doc(`${FIRESTORE_DATABASE}/FORTIGATEMASTERELECTION`);
        const fieldName = 'masterRecord';
        try {
            await document.update({
                [fieldName]: {
                MasterIP: candidateInstance.primaryPrivateIpAddress,
                InstanceId: candidateInstance.instanceId,
                VpcId: candidateInstance.virtualNetworkId,
                SubnetId: 'null',
                voteEndTime: datetoInt + (90 * 1000), // TODO:script timeout
                VoteState: voteState},
            });

            return true;
        } catch (err) {
            console.log(`Error in updating master record. ${err}`);
        }
        return false;
    }

    public async getMasterRecord(): Promise<AutoScaleCore.MasterElection.MasterRecord> {
        console.log('getting Master record');
        // First assign the doc to the table name or path. Then Call get to retrieve data.
        const fireStoreDocument = this.fireStoreClient.doc(`${FIRESTORE_DATABASE}/FORTIGATEMASTERELECTION`);
        let getDoc;
        try {
         getDoc = await fireStoreDocument.get();
        } catch (err) {
            console.log(`Error in getting master record ${err}`);
        }
        if (getDoc && getDoc._fieldsProto && getDoc._fieldsProto.masterRecord &&
            getDoc._fieldsProto.masterRecord.mapValue.fields &&
            getDoc._fieldsProto.masterRecord.mapValue.fields.MasterIP &&
            getDoc._fieldsProto.masterRecord.mapValue.fields.InstanceId) {
            const docData = {
                ip: getDoc._fieldsProto.masterRecord.mapValue.fields.MasterIP.stringValue,
                instanceId: getDoc._fieldsProto.masterRecord.mapValue.fields.InstanceId.stringValue,
                scalingGroupName: null,
                subnetId: getDoc._fieldsProto.masterRecord.mapValue.fields.SubnetId.stringValue,
                voteEndTime: getDoc._fieldsProto.masterRecord.mapValue.fields.voteEndTime.integerValue,
                voteState: getDoc._fieldsProto.masterRecord.mapValue.fields.VoteState.stringValue,
                vpcId: getDoc._fieldsProto.masterRecord.mapValue.fields.VpcId.stringValue,
            };
            console.log(`Master Record  + ${docData}`)
            return docData;
        } else {
            console.log('No Master record found in DB returning Null');
            return null;
        }
    }
    public async removeMasterRecord(): Promise<void> {
        const fireStoreDocument = this.fireStoreClient.doc(`${FIRESTORE_DATABASE}/FORTIGATEMASTERELECTION`);
        try {

            await fireStoreDocument.update({
                masterRecord: FieldValue.delete(),
            });
            console.log('Removing master Record');
        } catch (err) {
            console.log('Error in removing Master Record', err);
        }

    }

    public async getInstanceHealthCheck(descriptor: AutoScaleCore.VirtualMachineDescriptor,
                                        heartBeatInterval?: number): Promise<AutoScaleCore.HealthCheck> {
                if (descriptor && descriptor.instanceId) {
                    console.log('getting Record from AutoScale Table');
                    var recordId = descriptor.instanceId;
                } else {
                    console.log('No Instance ID provided to getInstanceHealthCheck. Returning Null');
                    return null;
                }
                const fireStoreDocument = this.fireStoreClient.doc(`${FIRESTORE_DATABASE}/FORTIGATEAUTOSCALE`);
                let getDoc;
                try {
                    getDoc = await fireStoreDocument.get();
                } catch (err) {
                    console.log(`Error in getInstanceHealthCheck. Could not retrieve instance record ${err}`);
                    throw(err);
                }
                if (getDoc && getDoc._fieldsProto && getDoc._fieldsProto[recordId] &&
                    getDoc._fieldsProto[recordId].mapValue.fields
                    ) {
                        var docData : AutoScaleCore.HealthCheck= {
                        instanceId: recordId,
                        inSync: getDoc._fieldsProto[recordId].mapValue.fields.inSync.booleanValue,
                        healthy: getDoc._fieldsProto[recordId].mapValue.fields.healthy.booleanValue,
                        masterIp: getDoc._fieldsProto[recordId].mapValue.fields.masterIp.stringValue,
                        // In the case that HeartBeatLoss is not yet defined return 0. Only occurs on first set up.
                        heartBeatLossCount: getDoc._fieldsProto[recordId].mapValue.fields.heartBeatLossCount.integerValue || 0,
                        heartBeatInterval: getDoc._fieldsProto[recordId].mapValue.fields.heartBeatInterval.integerValue || 25,
                        nextHeartBeatTime: getDoc._fieldsProto[recordId].mapValue.fields.nextHeartBeatTime.integerValue,
                        ip: getDoc._fieldsProto[recordId].mapValue.fields.ip.stringValue,
                        syncState: getDoc._fieldsProto[recordId].mapValue.fields.syncState.stringValue,
                        };
                    }
                return docData;
    }
    public async updateInstanceHealthCheck(healthCheck: AutoScaleCore.HealthCheck,
                                           heartBeatInterval: number, masterIp: string,
                                           checkPointTime: number, forceOutOfSync?: boolean): Promise<boolean> {
        const datetoInt = checkPointTime || Date.now();
        const autoScaleRecordUpdate = this.fireStoreClient;
        const document = autoScaleRecordUpdate.doc(`${FIRESTORE_DATABASE}/FORTIGATEAUTOSCALE`);
        const fieldName = healthCheck.instanceId;
        var instanceRecord: AutoScaleCore.HealthCheck = {
            instanceId: healthCheck.instanceId,
            ip: healthCheck.ip,
            inSync: healthCheck.inSync,
            heartBeatLossCount: healthCheck.heartBeatLossCount || 0,
            heartBeatInterval,
            masterIp,
            syncState: healthCheck.syncState,
            nextHeartBeatTime: datetoInt,
            healthy: healthCheck.healthy,
        };
        try {
            await document.update({
                [fieldName] :
                    instanceRecord,
            });
            return true;
        } catch (err) {
            console.log(`Error in updateInstanceHealthCheck. Could not updateAutoScale Record. for ${healthCheck.ip} Error: ${err}`);
            throw(err);
        }

    }
    public async deleteInstanceHealthCheck(instanceId: string): Promise<boolean> {
        const fireStoreDocument = this.fireStoreClient.doc(`${FIRESTORE_DATABASE}/FORTIGATEAUTOSCALE`);
        try {
            await fireStoreDocument.update({
                [instanceId]: FieldValue.delete(),
            });
        } catch (err) {
            console.log('Error in removing AutoScale Record', err);
            return false;
        }
        console.log('Removed AutoScale Record');
        return true;
    }

    public async finalizeMasterElection(): Promise<boolean> {
            console.log('Finalizing Master Election');
            const autoScaleRecordUpdate = this.fireStoreClient;
            const document = autoScaleRecordUpdate.doc(`${FIRESTORE_DATABASE}/FORTIGATEMASTERELECTION`);
            try {
                // Updates a nested object without removing the entire object.
                await document.update({
                    ['masterRecord.' + 'VoteState']: 'done',
                });
            } catch (err) {
                console.log(`Error in finalizeMasterElection could not update Master record. ${err}`);
            }
            return true;
        }
    public async setSettingItem(key: string, value: string | {}, description?: string, jsonEncoded?: boolean, editable?: boolean): Promise<boolean> {
        console.log('Updating Setting Database' );
        const document = this.fireStoreClient.doc(`${FIRESTORE_DATABASE}/SETTINGS`);
        console.log(key, value);
        try {
            await document.update({
                [key] : {
                    settingValue: value ? value : null,
                    editable: editable ? editable : false,
                    jsonEncoded: jsonEncoded ? jsonEncoded : false,
                    description: description ? description : 'No Description',
                },
            });
        } catch (err) {
            console.log(`Error in Updating Setting Table ${err}`);
        }

        return true;
    }
    // Parses the GCP request and returns the instanceId, HeartBeat Interval and status
    public extractRequestInfo(runtimeAgent: GCPRuntimeAgent): AutoScaleCore.RequestInfo {
        let interval = parseInt(process.env.HEARTBEAT_INTERVAL, 10) || 25;
        if (runtimeAgent && runtimeAgent.headers && runtimeAgent.headers['fos-instance-id']) {
            var instanceId = runtimeAgent.headers['fos-instance-id'];
        } else if (runtimeAgent) {
            // FortiGate does not send encoding, so a request must be parsed as follows:
            const parseReq = JSON.parse(Object.keys(runtimeAgent.body)[0]);
            instanceId = parseReq.instance;
            interval = parseReq.interval;
        } else if (runtimeAgent) {
            try {
                var instanceId = runtimeAgent.instance;
                } catch (ex) {
                this.logger.info('calling extractRequestInfo: unexpected body content format ', ex);
            }
        } else {
            this.logger.error('calling extractRequestInfo: no request body found.');
        }
        console.log('Extracted instanceID:', instanceId);
        return {
            instanceId,
            interval,
            status: null,
        };
    }
        // Takes instanceID and returns IP etc.
    public async describeInstance(descriptor: AutoScaleCore.VirtualMachineDescriptor): Promise<GCPVirtualMachine> {
    const options = {
        // Filter Options can be found here:
        // https://cloud.google.com/nodejs/docs/reference/compute/0.10.x/Compute#getVMs
    };
    try {
        console.log('Fetching VMs');
        const [vms] = await this.compute.getVMs(options);
        for (let vmData of vms) {
            if (vmData.metadata.id === descriptor.instanceId) {
                // TODO: look into additional values of the VM types.
                var vmReturn:any = {
                    instanceId: vmData.metadata.id,
                    PrivateIpAddress: vmData.metadata.networkInterfaces[0].networkIP,
                    primaryPrivateIpAddress: vmData.metadata.networkInterfaces[0].networkIP,
                    SubnetId: vmData.metadata.networkInterfaces[0].subnetwork,
                    virtualNetworkId: 'empty',
                };
                return vmReturn;
            }
        }
    } catch (err) {
        console.log(err);
        throw err;
    }
    return null;

    }

    public gcpSplitURL(indexItem: string): string {
        const lastindex = indexItem.lastIndexOf('/');
        const result = indexItem.substring(lastindex + 1);
        return result;
    }
    public async getCallbackEndpointUrl(processor?: AutoScaleCore.DataProcessor<GCPRuntimeAgent, URL>): Promise<URL> {
        const functionURL = new URL(TRIGGER_URL);
        console.log('CallbackURL', functionURL);
        return functionURL;
    }

    public async terminateInstanceInAutoScalingGroup(instance: GCPVirtualMachine): Promise<boolean> {
        try {
            const vm = await this.compute.vm(instance).delete();
            console.log(`Deleted instance:  ${instance.instanceId}`);
            return true;
        } catch (err) {
            console.log(`Failed to Delete instance:  ${err}`);
            return false;
        }

    }

    public deleteInstances(parameters: AutoScaleCore.VirtualMachineDescriptor[]): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    public createNetworkInterface(parameters: AutoScaleCore.NetworkInterfaceDescriptor): Promise<boolean | AutoScaleCore.NetworkInterfaceLike> {
        throw new Error('Method not implemented.');
    }
    public deleteNetworkInterface(parameters: AutoScaleCore.NetworkInterfaceDescriptor): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    public describeNetworkInterface(parameters: AutoScaleCore.NetworkInterfaceDescriptor): Promise<AutoScaleCore.NetworkInterfaceLike> {
        throw new Error('Method not implemented.');
    }
    public listNetworkInterfaces(parameters: AutoScaleCore.FilterLikeResourceQuery<GCPNameValuesPair>, statusToInclude?: string[]): Promise<AutoScaleCore.NetworkInterfaceLike[]> {
        throw new Error('Method not implemented.');
    }
    public attachNetworkInterface(instance: GCPVirtualMachine, nic: AutoScaleCore.NetworkInterfaceLike): Promise<string | boolean> {
        throw new Error('Method not implemented.');
    }
    public detachNetworkInterface(instance: GCPVirtualMachine, nic: AutoScaleCore.NetworkInterfaceLike): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    public listNicAttachmentRecord(): Promise<AutoScaleCore.NicAttachmentRecord[]> {
        throw new Error('Method not implemented.');
    }
    public getNicAttachmentRecord(instanceId: string): Promise<AutoScaleCore.NicAttachmentRecord> {
        throw new Error('Method not implemented.');
    }
    public updateNicAttachmentRecord(instanceId: string, nicId: string, state: AutoScaleCore.NicAttachmentState, conditionState?: AutoScaleCore.NicAttachmentState): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    public deleteNicAttachmentRecord(instanceId: string, conditionState?: AutoScaleCore.NicAttachmentState): Promise<boolean> {
        throw new Error('Method not implemented.');
    }

    public listBlobFromStorage(parameters: AutoScaleCore.BlobStorageItemDescriptor): Promise<AutoScaleCore.Blob[]> {
        throw new Error('Method not implemented.');
    }
    public listLicenseFiles(parameters?: AutoScaleCore.BlobStorageItemDescriptor): Promise<Map<string, AutoScaleCore.LicenseItem>> {
        throw new Error('Method not implemented.');
    }
    public updateLicenseUsage(licenseRecord: AutoScaleCore.LicenseRecord, replace?: boolean): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    public listLicenseUsage(): Promise<Map<string, AutoScaleCore.LicenseRecord>> {
        throw new Error('Method not implemented.');
    }
    public listLicenseStock(): Promise<Map<string, AutoScaleCore.LicenseRecord>> {
        throw new Error('Method not implemented.');
    }
    public updateLicenseStock(licenseItem: AutoScaleCore.LicenseItem, replace?: boolean): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    public deleteLicenseStock(licenseItem: AutoScaleCore.LicenseItem): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    public getVmInfoCache(scaleSetName: string, instanceId: string, vmId?: string): Promise<{}> {
        throw new Error('Method not implemented.');
    }
    public setVmInfoCache(scaleSetName: string, info: {}, cacheTime?: number): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public getExecutionTimeRemaining(): number {
        return Number(SCRIPT_TIMEOUT) - AutoScaleCore.Functions.getTimeLapse();
    }
    public describeVirtualNetwork(parameters: AutoScaleCore.VirtualNetworkDescriptor): Promise<AutoScaleCore.VirtualNetworkLike> {
        throw new Error('Method not implemented.');
    }
    public listSubnets(parameters: AutoScaleCore.VirtualNetworkDescriptor): Promise<AutoScaleCore.SubnetLike[]> {
        throw new Error('Method not implemented.');
    }
    public getLifecycleItems(instanceId: string): Promise<AutoScaleCore.LifecycleItem[]> {
        throw new Error('Method not implemented.');
    }
    public updateLifecycleItem(item: AutoScaleCore.LifecycleItem): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    public removeLifecycleItem(item: AutoScaleCore.LifecycleItem): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    public cleanUpDbLifeCycleActions(items: AutoScaleCore.LifecycleItem[]): Promise<boolean | AutoScaleCore.LifecycleItem[]> {
        throw new Error('Method not implemented.');
    }

}

class GCPAutoScaleHandler extends AutoscaleHandler<
GCPPlatformRequest,
GCPPlatformContext,
Console,
GCPNameValuesPair,
GCPPlatform.Instance,
GCPVirtualMachine,
GCPRuntimeAgent,
GCP
> {
    constructor(platform: GCP) {
        super(platform);
        this._step = '';
        this._selfInstance = null;
        this._masterRecord = null;
        this._selfHealthCheck = null;
        this.scalingGroupName = process.env.AUTO_SCALING_GROUP_NAME;
        this.compute = new Compute(); }
    public logger: AutoScaleCore.Logger<Console>;
    // tslint:disable-next-line: variable-name
    public _step: string;
    public compute: object;
    private fireStoreClient = new Firestore();
    public async removeInstance(instance: GCPVirtualMachine): Promise<boolean> {
        return await this.platform.terminateInstanceInAutoScalingGroup(instance);

    }
    public async init(): Promise<boolean> {
        const requiredSettings = {
            'asset-storage-name': ASSET_STORAGE_NAME,
            'fortigate-psk-secret': FORTIGATE_PSK_SECRET,
            'asset-storage-key-prefix': process.env.ASSET_STORAGE_KEY_PREFIX,
            'fortigate-default-password': 'empty',
            'required-configset': 'empty',
            'fortigate-autoscale-vpc-id': 'empty', // TODO:Pass VPC from Terraform ENV var and from VM fetch.
            'settings-initialized': 'true',
            'project-id': PROJECT_ID,
            'trigger-url': TRIGGER_URL,
            'resource-tag-prefix': process.env.RESOURCE_TAG_PREFIX,
            'payg-scaling-group-name': process.env.PAYG_SCALING_GROUP_NAME,
            'byol-scaling-group-name': process.env.BYOL_SCALING_GROUP_NAME,
            'master-scaling-group-name': process.env.MASTER_SCALING_GROUP_NAME,
            'required-config-set': process.env.REQUIRED_CONFIG_SET,
            'unique-id': process.env.UNIQUE_ID,
            'custom-id': process.env.CUSTOM_ID,
            'autoscale-handler-url': process.env.AUTOSCALE_HANDLER_URL,
            'deployment-settings-saved': process.env.DEPLOYMENT_SETTINGS_SAVED,
            'enable-fortigate-elb': process.env.ENABLE_FORTIGATE_ELB,
            'enable-dynamic-nat-gateway': process.env.ENABLE_DYNAMIC_NAT_GATEWAY,
            'enable-hybrid-licensing': process.env.ENABLE_HYBRID_LICENSING,
            'enable-internal-elb': process.env.ENABLE_INTERNAL_ELB,
            'enable-second-nic': process.env.ENABLE_SECOND_NIC,
            'enable-vm-info-cache': process.env.ENABLE_VM_INFO_CACHE,
            'fortigate-admin-port': process.env.FORTIGATE_ADMIN_PORT,
            'fortigate-sync-interface': process.env.FORTIGATE_SYNC_INTERFACE,
            'master-election-no-wait': process.env.MASTER_ELECTION_NO_WAIT,
            'heartbeat-interval': process.env.HEARTBEAT_INTERVAL,
            'heart-beat-delay-allowance': process.env.HEART_BEAT_DELAY_ALLOWANCE,
        };
        const db = await getTables();
        const fireStoreDocument = this.fireStoreClient.doc(`${FIRESTORE_DATABASE}/SETTINGS`);
        const tableArray = [db.FORTIGATEAUTOSCALE, db.FORTIGATEMASTERELECTION, db.LIFECYCLEITEM, db.FORTIANALYZER,
            db.SETTINGS];
        // Check if "settings-initialized" == true and if not Initilize the empty collections
        try {

            const getDoc: any = await fireStoreDocument.get();

            if (getDoc && getDoc._fieldsProto && getDoc._fieldsProto['deployment-settings-saved'] &&
                getDoc._fieldsProto['deployment-settings-saved'].mapValue.fields &&
                getDoc._fieldsProto['deployment-settings-saved'].mapValue.fields.settingValue &&
                getDoc._fieldsProto['deployment-settings-saved'].mapValue.fields.settingValue.stringValue &&
                getDoc._fieldsProto['deployment-settings-saved'].mapValue.fields.settingValue.stringValue === 'true'
                ) {
                    console.log('Settings already exist');
                    await this.loadSettings();
                } else {
                for (const table of tableArray) {
                    console.log(`Initializing FireStore Document ${table}`);
                    const tableCreate = await this.fireStoreClient.doc(`${FIRESTORE_DATABASE}/${table}`);
                    await tableCreate.set({
                    });
                }
                await this.saveSettings(requiredSettings);
                await this.saveSettings({
                      'deployment-settings-saved': 'true',
                  });
                await this.loadSettings();
            }
        } catch (err) {
            console.log('Error in getting record: ', err);
        }
        return true;

    }

    public async saveSettings(settings: {[key: string]: any}) {
        settings = {};
        Object.entries(process.env).forEach((entry) => {
            settings[entry[0].replace(new RegExp('_', 'g'), '')] = entry[1];
        });
        settings.deploymentsettingssaved = 'true';
        return await super.saveSettings(settings);
    }
    public updateCapacity(scalingGroupName: string, desiredCapacity: number, minSize: number, maxSize: number): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    public checkAutoScalingGroupState(scalingGroupName: string): Promise<string> {
        throw new Error('Method not implemented.');
    }

    public findRecyclableLicense(stockRecords: Map<string, LicenseRecord>, usageRecords: Map<string, LicenseRecord>, limit?: number | 'all'): Promise<LicenseRecord[]> {
        throw new Error('Method not implemented.');
    }

    public async addInstanceToMonitor(instance: GCPVirtualMachine, heartBeatInterval: number,
                                      masterIp?: string): Promise<boolean> {
        console.log(`Adding Instance to monitor (FORTIGATEAUTOSCALE) ${instance.instanceId}`);
        const datetoInt = Date.now();
        const nextHeartBeat = Date.now() + heartBeatInterval * 1000;
        const autoScaleRecordUpdate =  this.fireStoreClient;
        const document = autoScaleRecordUpdate.doc(`${FIRESTORE_DATABASE}/FORTIGATEAUTOSCALE`);
        const fieldName = instance.instanceId;

        try {
            await document.update({
                [fieldName] : {
                    heartBeatInterval: 0,
                    heartBeatLossCount: 0,
                    masterIp,
                    checkPointTime: datetoInt,
                    ip: instance.primaryPrivateIpAddress,
                    primaryPrivateIpAddress: instance.primaryPrivateIpAddress,
                    inSync: true,
                    syncState: 'in-sync',
                    nextHeartBeatTime: nextHeartBeat || 0,
                    healthy: true,
                },
            });
        } catch (err) {
            console.log(`Error in addInstanceToMonitor. Could not add instance ${instance.instanceId} to Database, ${err}`);
            return false;
        }
        return true;

    }
    public async handle(event: any, context: any, callback: any) {
        await super.handle(event, context, callback);
    }

    public async handleGetConfig(event?: any): Promise<AutoScaleCore.ErrorDataPairLike> {

        const instanceId = this._requestInfo.instanceId;
        this._selfInstance = this._selfInstance ||
        await this.platform.describeInstance({
            instanceId,
            scalingGroupName: this.scalingGroupName} as Platform.VirtualMachineDescriptor);
        const platform = this.platform;
        let config;
        let masterInfo;
        let masterIp;
        let duplicatedGetConfigCall;
        let hbSyncEndpoint: URL;
        const moreConfigSets: AutoScaleCore.ConfigSetParser[] = [];
        const promiseEmitter = this.checkMasterElection.bind(this),
            validator = (result) => {
                if (this._masterRecord && this._masterRecord.voteState === 'pending' &&
                    this._selfInstance &&
                    this._masterRecord.instanceId === this._selfInstance.instanceId &&
                    this._masterRecord.scalingGroupName === this.masterScalingGroupName) {
                    duplicatedGetConfigCall = true;
                    masterIp = this._masterRecord.ip;
                    return true;
                }
                if (result) {
                    if (result.primaryPrivateIpAddress ===
                        this._selfInstance.primaryPrivateIpAddress) {
                        masterIp = this._selfInstance.primaryPrivateIpAddress;
                        return true;
                    } else if (this._masterRecord) {
                        if (this._masterRecord.voteState === 'done') {
                            // master election done
                            return true;
                        } else if (this._masterRecord.voteState === 'pending') {
                            this._masterRecord = null;
                            return false;
                        } else {
                            return false;
                        }
                    } else {
                        this.logger.warn('master info found but master record not found. retry.');
                        return false;
                    }
                } else {
                    return this._settings['master-election-no-wait'].toString() === 'false';
                }
            },
            counter = () => {
                // if script is about to timeout
                if (platform.getExecutionTimeRemaining() < 3000) {
                    return false;
                }
                this.logger.warn('script execution is about to expire');
                return true;
            };
        try {
            masterInfo = await AutoScaleCore.Functions.waitFor(
                promiseEmitter, validator, 5000, 25);
        } catch (error) {
            console.log('HandlegetConfig Error: ', error);
            this._masterRecord = this._masterRecord || await this.platform.getMasterRecord();
            if (this._masterRecord && this._masterRecord.instanceId === this._selfInstance.instanceId &&
                this._masterRecord.scalingGroupName === this._selfInstance.scalingGroupName) {
                await this.platform.removeMasterRecord();
            }
            await this.removeInstance(this._selfInstance);
            throw new Error('Failed to determine the master instance. This instance is unable' +
                ' to bootstrap. Please report this to' +
                ' administrators.');
        }
        if (duplicatedGetConfigCall || masterIp === this._selfInstance.primaryPrivateIpAddress) {
            hbSyncEndpoint = await this.platform.getCallbackEndpointUrl();
            config = await this.getMasterConfig(hbSyncEndpoint, moreConfigSets);
            console.log('called handleGetConfig: returning master config' +
                `(master-ip: ${masterIp}):\n ${config}`);
            return config;
        } else {
            const getPendingMasterIp =
                !(this._settings['master-election-no-wait'].toString() === 'true' &&
                this._masterRecord &&
                this._masterRecord.voteState === AutoScaleCore.MasterElection.VoteState.pending);
            hbSyncEndpoint = await this.platform.getCallbackEndpointUrl();
            const allowHeadless = this._settings['master-election-no-wait'].toString() === 'false';
            masterIp = getPendingMasterIp && masterInfo &&
                masterInfo.primaryPrivateIpAddress || null;
            config = await this.getSlaveConfig(hbSyncEndpoint, allowHeadless, masterIp,
                moreConfigSets);
            console.log('called handleGetConfig: returning slave config' +
                `(master-ip: ${masterIp || 'undetermined'}):\n ${config}`);
            return config;
        }
    }
    public handleAutoScalingEvent(event?: unknown): Promise<AutoScaleCore.ErrorDataPairLike> {
        throw new Error('Method not implemented.');
    }
    public handleWithAgent(): Promise<any> {
        throw new Error('Method not implemented.');
    }
    public proxyResponse(statusCode: number, res: {}, logOptions?: {}) {
        const response = {
                statusCode,
                headers: {},
                body: typeof res === 'string' ? res : JSON.stringify(res),
                isBase64Encoded: false,
        };
        console.log('Response', response);
        return response;
     }
    public parseConfigSet(configSet: string, parser: AutoScaleCore.ConfigSetParser): Promise<string> {
        throw new Error('Method not implemented.');
    }
    public getFazIp(): Promise<string> {
        throw new Error('Method not implemented.');
    }
    public handleNicAttachment(): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    public handleNicDetachment(): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    // Life Cylce actions are not used in GCP, dummy function to pass true when called by handlesyncedcallback.
    public async handleLifecycleAction(instanceId: string, action: AutoScaleCore.LifecycleAction, fulfilled: boolean): Promise<boolean> {
        return true;
    }

    public updateNatGatewayRoute(): Promise<void> {
        throw new Error('Method not implemented.');
    }
}

exports.main = async function(req, res, callback) {
    if (FIRESTORE_DATABASE &&
    ASSET_STORAGE_NAME &&
    FORTIGATE_PSK_SECRET &&
    TRIGGER_URL &&
    PROJECT_ID) {
        let context;
        const logger = new AutoScaleCore.Functions.DefaultLogger(console);
        const RuntimeAgent: GCPRuntimeAgent = new GCPRuntimeAgent(req, context, logger, callback);
        const platform: GCP = new GCP(RuntimeAgent);
        const handler = new GCPAutoScaleHandler(platform);
        console.log('Calling Handler');
        callback = (err, data) => {
            console.log('Response', data.body);
            res.status(200).send(data.body);
            res.end();
            };
        return await handler.handle(req, context, callback);
    } else {
     console.log(`FIRESTORE_DATABASE, ASSET_STORAGE_NAME, FORTIGATE_PSK_SECRET, TRIGGER_URL AND
      PROJECT_ID Must be defined. Terminating Function.`);
     res.end();
 }
};
async function getTables() {
    const dbCollection = Tables;
    return await dbCollection;
}
if (module === require.main) {
    exports.main(console.log);
}
