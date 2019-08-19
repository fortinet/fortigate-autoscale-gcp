import {Logger} from './core/logger';
import { Tables } from './core/db-definitions';
import {Firestore, FieldValue} from '@google-cloud/firestore';
import * as AutoScaleCore from 'fortigate-autoscale-core';
import Compute from '@google-cloud/compute';
import {Storage} from '@google-cloud/storage';
import { CloudPlatform, LicenseRecord } from './core'; // TODO: remove
import {AutoscaleHandler} from './core/autoscale-handler';
import * as Platform from './core/cloud-platform';
import { URL } from 'url';

const firestore = new Firestore();
const
    FIRESTORE_DATABASE = process.env.FIRESTORE_DATABASE,
    SCRIPT_EXECUTION_TIME_CHECKPOINT = Date.now(),
    ASSET_STORAGE_NAME = process.env.ASSET_STORAGE_NAME,
    FORTIGATE_PSK_SECRET = process.env.FORTIGATE_PSK_SECRET,
    TRIGGER_URL = process.env.TRIGGER_URL,
    PROJECT_ID = process.env.PROJECT_ID;

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
        InstanceId: string;
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
    [x: string]: any;
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
// export interface GCPVirtualMachineDescriptor
//     extends AutoScaleCore.VirtualMachineDescriptor,
//         GCPPlatform.Instance {}

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
    getRemainingTimeInMillis(): number;
}

export interface GCPNameValuesPair extends GCPPlatform.Filter {
    kind: 'GCPNameValuesPair';
}
// TODO: Check why this is coming from Platform
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
    public compute: any = new Compute();
    public blobStorage: any = new Storage({
        projectId: PROJECT_ID,
    });
    public respond(response: AutoScaleCore.ErrorDataPairLike, httpStatusCode?: number): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public describeScalingGroup(decriptor: AutoScaleCore.ScalingGroupDecriptor): Promise<AutoScaleCore.ScalingGroupLike> {
        throw new Error('Method not implemented.');
    }
    // tslint:disable-next-line: variable-name
    public getTgwVpnAttachmentRecord(_selfInstance: GCPVirtualMachine) {
        throw new Error('Method not implemented.');
    }

    public async getSettingItems(keyFilter?: string[], valueOnly?: boolean) {
        let item;
        let settingItem: AutoScaleCore.SettingItem;
        const fireStoreClient = new Firestore();
        const fireStoreDocument = fireStoreClient.doc(FIRESTORE_DATABASE + '/SETTINGS');
        try {
            let items: any; // TODO: set explicit types for JSON object.https://stackoverflow.com/questions/30089879/typescript-and-dot-notation-access-to-objects
            const getDoc: any = await fireStoreDocument.get();
            const formattedItems: AutoScaleCore.SettingItems = {};
            const filteredItems: AutoScaleCore.SettingItems = {};
            if (getDoc && getDoc._fieldsProto && getDoc._fieldsProto &&
                getDoc._fieldsProto) {
                    // tslint:disable-next-line: forin
                    for (item in getDoc._fieldsProto) {
                        // An empty String in FireStore counts as undefined
                        // TODO: Simplfiy this conditional.
                        // TODO: fix logic
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
                        console.log('Formated Items', formattedItems);
                    }
            }
            this.__settings = formattedItems;

            console.log('Formated Items', formattedItems);
            return keyFilter && filteredItems || formattedItems;
        } catch (err) {
            console.log('Error Getting Setting Items', err);
            throw err;
        }
}

    public getLicenseFileContent(descriptor: AutoScaleCore.BlobStorageItemDescriptor): Promise<string> {
        throw new Error('Method not implemented.');
    }

    public async init(): Promise<boolean> {
        this.logger = new AutoScaleCore.Functions.DefaultLogger(console);
        console.log('GCP init');
        // Null and undefined create issues. Firestore
        const requiredSettings = {
            'asset-storage-name': ASSET_STORAGE_NAME,
            'fortigate-psk-secret': FORTIGATE_PSK_SECRET,
            'asset-storage-key-prefix': 'empty',
            'deployment-settings-saved': 'empty',
            'enable-second-nic': 'empty',
            'fortigate-default-password': 'empty',
            'master-election-no-wait': 'false',
            'required-configset': 'empty',
            'master-scaling-group-name': 'empty',
            'fortigate-autoscale-vpc-id': 'empty', // TODO:Pass VPC from Terraform ENV var and from VM fetch.
            'settings-initialized': 'true',
        };
        const db = await getTables();
        const fireStoreClient = new Firestore();
        const fireStoreDocument = fireStoreClient.doc(FIRESTORE_DATABASE + '/SETTINGS');
        const tableArray = [db.FORTIGATEAUTOSCALE, db.FORTIGATEMASTERELECTION, db.LIFECYCLEITEM, db.FORTIANALYZER,
            db.SETTINGS];
        // Check if "settings-initialized" == true and if not Initilize the empty collections
        try {
            const getDoc: any = await fireStoreDocument.get();
            if (getDoc && getDoc._fieldsProto && getDoc._fieldsProto['settings-initialized'] &&
                getDoc._fieldsProto['settings-initialized'].mapValue.fields &&
                getDoc._fieldsProto['settings-initialized'].mapValue.fields.settingValue &&
                getDoc._fieldsProto['settings-initialized'].mapValue.fields.settingValue.stringValue &&
                getDoc._fieldsProto['settings-initialized'].mapValue.fields.settingValue.stringValue === 'true'
                ) {
                    console.log('Settings already exist');
                } else {
                for (const table of tableArray) {
                    console.log('Initializing FireStore');
                    const tableCreate = await firestore.doc(FIRESTORE_DATABASE + '/' + table);
                    await tableCreate.set({
                    });
                }
                for (const item in requiredSettings) {
                    await this.setSettingItem(item, requiredSettings[item]);
                }
            }
        } catch (err) {
            console.log('Error in getting record: ', err);
        }
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
    public async putMasterRecord(candidateInstance: GCPVirtualMachine, voteState: AutoScaleCore.MasterElection.VoteState, method: AutoScaleCore.MasterElection.VoteMethod): Promise<boolean> {
        console.log('Updating Master Record Database', candidateInstance);
        const datetoInt = Date.now();
        const masterUpdateClient = new Firestore();
        const document = masterUpdateClient.doc(FIRESTORE_DATABASE + '/FORTIGATEMASTERELECTION');
        const fieldName = 'masterRecord';
        // TODO: add try/catch
        await document.update({
            [fieldName]: {
            MasterIP: candidateInstance.primaryPrivateIpAddress,
            InstanceId: candidateInstance.InstanceId,
            VpcId: candidateInstance.VpcId ,
            SubnetId: 'null',
            voteEndTime: datetoInt + (90 * 1000), // TODO:script timeout
            VoteState: voteState},
        });
        return true;
    }

    public async getMasterRecord(): Promise<AutoScaleCore.MasterElection.MasterRecord> {
        console.log('getting Master record');
        const fireStoreClient = new Firestore();
        // First assign the doc to the table name or path. Then Call get to retrieve data.
        const fireStoreDocument = fireStoreClient.doc(FIRESTORE_DATABASE + '/FORTIGATEMASTERELECTION');
        let getDoc: any; // TODO: set explicit types for JSON object.https://stackoverflow.com/questions/30089879/typescript-and-dot-notation-access-to-objects
        try {
         getDoc = await fireStoreDocument.get();
        } catch (err) {
            console.log('Error in getting master record ', err);
        }
        if (getDoc && getDoc._fieldsProto && getDoc._fieldsProto.masterRecord &&
            getDoc._fieldsProto.masterRecord.mapValue.fields &&
            getDoc._fieldsProto.masterRecord.mapValue.fields.MasterIP &&
            getDoc._fieldsProto.masterRecord.mapValue.fields.InstanceId) {
            const docData = {
                ip: getDoc._fieldsProto.masterRecord.mapValue.fields.MasterIP.stringValue,
                instanceId: getDoc._fieldsProto.masterRecord.mapValue.fields.InstanceId.stringValue,
                scalingGroupName: null, // TODO look into what we need to get this value.
                subnetId: getDoc._fieldsProto.masterRecord.mapValue.fields.SubnetId.stringValue,
                voteEndTime: getDoc._fieldsProto.masterRecord.mapValue.fields.voteEndTime.integerValue,
                voteState: getDoc._fieldsProto.masterRecord.mapValue.fields.VoteState.stringValue,
                vpcId: getDoc._fieldsProto.masterRecord.mapValue.fields.VpcId.stringValue,
            };
            return docData;
        } else {
            console.log('No Master record found in DB returning Null');
            return null;
        }
    }
    public async removeMasterRecord(): Promise<void> {
        const fireStoreClient = new Firestore();
        const fireStoreDocument = fireStoreClient.doc(FIRESTORE_DATABASE + '/FORTIGATEMASTERELECTION');
        try {

            await fireStoreDocument.update({
                masterRecord: FieldValue.delete(),
            });
        } catch (err) {
            console.log('Error in removing Master Record', err);
        }
        console.log('Removing master Record');
    }

    public async getInstanceHealthCheck(descriptor: AutoScaleCore.VirtualMachineDescriptor, heartBeatInterval?: number): Promise<AutoScaleCore.HealthCheck> {
                if (descriptor && descriptor.instanceId) {
                    console.log('getting Record from AutoScale Table');
                    var recordId = descriptor.instanceId;
                } else {
                    console.log('No Instance ID provided to getInstanceHealthCheck. Returning Null');
                    return null;
                }
                const fireStoreClient = new Firestore();
                const fireStoreDocument = fireStoreClient.doc(FIRESTORE_DATABASE + '/FORTIGATEAUTOSCALE');
                let getDoc: any; // TODO: set explicit types for JSON object.https://stackoverflow.com/questions/30089879/typescript-and-dot-notation-access-to-objects
                try {
                    getDoc = await fireStoreDocument.get();
                } catch (err) {
                    console.log('Error in getting record: ', err);
                }
                if (getDoc && getDoc._fieldsProto && getDoc._fieldsProto[recordId] &&
                    getDoc._fieldsProto[recordId].mapValue.fields &&
                    getDoc._fieldsProto[recordId].mapValue.fields.InstanceId
                    ) {
                        var docData = {
                        instanceId: getDoc._fieldsProto[recordId].mapValue.fields.InstanceId.stringValue,
                        inSync: getDoc._fieldsProto[recordId].mapValue.fields.inSync.stringValue,
                        healthy: getDoc._fieldsProto[recordId].mapValue.fields.healthy.stringValue,
                        masterIp: getDoc._fieldsProto[recordId].mapValue.fields.masterIp.stringValue,
                        heartBeatLossCount:  getDoc._fieldsProto[recordId].mapValue.fields.heartBeatLossCount.stringValue,
                        heartBeatInterval: getDoc._fieldsProto[recordId].mapValue.fields.heartBeatInterval.stringValue,
                        nextHeartBeatTime: getDoc._fieldsProto[recordId].mapValue.fields.nextHeartBeatTime.stringValue,
                        ip: getDoc._fieldsProto[recordId].mapValue.fields.primaryPrivateIpAddress.stringValue,
                        syncState: getDoc._fieldsProto[recordId].mapValue.fields.syncState.stringValue,
                        };
                    }
                console.log('AutoScaleTableData', docData);
                return docData;
    }
    public async updateInstanceHealthCheck(healthCheck: AutoScaleCore.HealthCheck, heartBeatInterval: number, masterIp: string, checkPointTime: number, forceOutOfSync?: boolean): Promise<boolean> {
        const datetoInt = Date.now();
        const autoScaleRecordUpdate = new Firestore();
        const document = autoScaleRecordUpdate.doc(FIRESTORE_DATABASE + '/FORTIGATEAUTOSCALE');
        const fieldName = healthCheck.instanceId;
        try {
            await document.update({
                [fieldName] : {
                    instanceId: healthCheck.instanceId,
                    ip: healthCheck.ip,
                    inSync: healthCheck.inSync,
                    healthCheck: healthCheck.masterIp,
                    heartBeatLossCount: healthCheck.heartBeatLossCount,
                    heartBeatInterval,
                    masterIp,
                    checkPointTime: datetoInt, // TODO: update to checkpointtime
                    healthy: healthCheck.healthy,
                },
            });
        } catch (err) {
            console.log('Error in Updating AutoScale Record', err);
        }
        return true;
    }
    public async deleteInstanceHealthCheck(instanceId: string): Promise<boolean> {
        const fireStoreClient = new Firestore();
        const fireStoreDocument = fireStoreClient.doc(FIRESTORE_DATABASE + '/FORTIGATEAUTOSCALE');
        try {
            await fireStoreDocument.update({
                [instanceId]: FieldValue.delete(),
            });
        } catch (err) {
            console.log('Error in removing AutoScale Record', err);
            return false;
        }
        console.log('Removing AutoScale Record');
        return true;
    }

    public async finalizeMasterElection(): Promise<boolean> {
            console.log('Finalizing Master Election');
            const autoScaleRecordUpdate = new Firestore();
            const document = autoScaleRecordUpdate.doc(FIRESTORE_DATABASE + '/FORTIGATEMASTERELECTION'); // TODO: fix autoscalerecordupate names for each firestore var
            try {
                // Updates a nested object without removing the entire object.
                await document.update({
                    ['masterRecord.' + 'VoteState']: 'done',
                });
            } catch (err) {
                console.log('Error in Updating AutoScale Record', err);
            }
            return true;
        }
    public async setSettingItem(key: string, value: string | {}, description?: string, jsonEncoded?: boolean, editable?: boolean): Promise<boolean> {
        console.log('Updating Setting Database' );
        const firestoreClient = new Firestore();
        const document = firestoreClient.doc(FIRESTORE_DATABASE + '/SETTINGS');
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
            console.log('Error in Updating Setting Table', err);
        }
        return true;
    }
    // Parses the GCP request and returns the instanceId, HeartBeat Interval and status
    public extractRequestInfo(runtimeAgent: GCPRuntimeAgent): AutoScaleCore.RequestInfo {
        let interval = 25; // TODO:DEFAULT_HEART_BEAT_INTERVAL;
        if (runtimeAgent && runtimeAgent.headers && runtimeAgent.headers['fos-instance-id']) {
            var instanceId = runtimeAgent.headers['fos-instance-id'];
        } else if (runtimeAgent) {
            console.log('Setting ID');
            console.log(runtimeAgent.body);
            // TODO: add check in case they fix this
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
    public async describeInstance(descriptor: AutoScaleCore.VirtualMachineDescriptor) {
    const options = {
        // Filter Options can be found here:
        // https://cloud.google.com/nodejs/docs/reference/compute/0.10.x/Compute#getVMs
    };
    try {
        console.log('Fetching VMs');
        const [vms] = await this.compute.getVMs(options);
        for (let vmData of vms) {
            if (vmData.metadata.id === descriptor.instanceId) {
                console.log(vmData);
                var vmReturn = {
                    InstanceId: vmData.metadata.id,
                    PrivateIpAddress: vmData.metadata.networkInterfaces[0].networkIP,
                    primaryPrivateIpAddress: vmData.metadata.networkInterfaces[0].networkIP,
                    SubnetId: vmData.metadata.networkInterfaces[0].subnetwork,
                    VpcId: 'empty',
                };
                console.log(JSON.stringify(vmReturn));
                return vmReturn;
            }
        }
        console.log(JSON.stringify(vmReturn));
        return vms;
    } catch (err) {
        console.log(err);
        throw err;
    }
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
        console.log('Removing Instance');
        try {
        const vm = await this.compute.vm(instance).delete();
        } catch (err) {
            console.log('Failed to Delete instance: ' + err);
        }
        console.log('Deleted instance: ' + instance);
        return true;
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
        throw new Error('Method not implemented.');
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
        // this.masterScalingGroupName = process.env.AUTO_SCALING_GROUP_NAME;
        this.scalingGroupName = process.env.AUTO_SCALING_GROUP_NAME;
        this.compute = new Compute(); }
    public logger: AutoScaleCore.Logger<Console>;
    // tslint:disable-next-line: variable-name
    public _step: string;
    public compute: object;
    public async removeInstance(instance: GCPVirtualMachine): Promise<boolean> {
        return await this.platform.terminateInstanceInAutoScalingGroup(instance);

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

    public async addInstanceToMonitor(instance: GCPVirtualMachine, heartBeatInterval: Platform.ValidHeartbeatInterval, masterIp?: string): Promise<boolean> {
        console.log('Adding Instance to monitor (FORTIGATEAUTOSCALE)');
        console.log(instance.InstanceId);
        const datetoInt = Date.now();
        const nextHeartBeat = Date.now() + (10 * 1000);
        const autoScaleRecordUpdate = new Firestore();
        const document = autoScaleRecordUpdate.doc(FIRESTORE_DATABASE + '/FORTIGATEAUTOSCALE');
        const fieldName = instance.InstanceId;

        try {
            await document.update({
                [fieldName] : {
                    heartBeatInterval,
                    heartBeatLossCount: 0,
                    masterIp,
                    checkPointTime: datetoInt,
                    primaryPrivateIpAddress: instance.primaryPrivateIpAddress,
                    inSync: true,
                    syncState: 'in-sync',
                    nextHeartBeatTime: nextHeartBeat,
                    healthy: true,
                },
            });
        } catch (err) {
            console.log('Error in Updating AutoScale Record', err);
            return false;
        }
        return true;

    }
    public async handle(event: any, context: any, callback: any) {
        // this.useLogger(this.logger);
        await super.handle(event, context, callback);
    }

    public async handleGetConfig(event?: any): Promise<AutoScaleCore.ErrorDataPairLike> {
        const instanceId = this._requestInfo.instanceId;
        this._selfInstance = this._selfInstance ||
        (await this.platform.describeInstance({
            instanceId,
            scalingGroupName: this.scalingGroupName} as Platform.VirtualMachineDescriptor));
        console.log('This.SelfInstance', this._selfInstance);
        const platform = this.platform;
        let config;
        let masterInfo;
        let masterIp;
        let duplicatedGetConfigCall;
        let hbSyncEndpoint: URL;
        const moreConfigSets: AutoScaleCore.ConfigSetParser[] = [];
        const promiseEmitter = this.checkMasterElection.bind(this),
            validator = (result) => {
                console.log('validation');
                if (this._masterRecord && this._masterRecord.voteState === 'pending' &&
                    this._selfInstance &&
                    this._masterRecord.instanceId === this._selfInstance.instanceId &&
                    this._masterRecord.scalingGroupName === this.masterScalingGroupName) {
                    duplicatedGetConfigCall = true;
                    masterIp = this._masterRecord.ip;
                    return true;
                }
                if (result) {
                    console.log('Result, in Validator', result);
                    console.log('Self Instance', this._selfInstance);

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
                            // master is still pending
                            // if not wait for the master election to complete,
                            // TODO: add support for 'master-election-no-wait'
                            // if (this._settings['master-election-no-wait'].toString() === 'true') {
                            //     return true;
                            // // }
                            // else {
                            //     // master election not done, wait for a moment
                            //     // clear the current master record cache and get a new one
                            //     // in the next call
                            //     this._masterRecord = null;
                            //     return false;
                            // }
                        } else {
                            return false;
                        }
                    } else {
                        this.logger.warn('master info found but master record not found. retry.');
                        return false;
                    }
                } else {
                    return this._settings['master-election-no-wait'].toString() === 'true';
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
            const allowHeadless = this._settings['master-election-no-wait'].toString() === 'true';
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
    let context;
    const logger = new AutoScaleCore.Functions.DefaultLogger(console);
    const RuntimeAgent: GCPRuntimeAgent = new GCPRuntimeAgent(req, context, logger, callback);
    const platform: GCP = new GCP(RuntimeAgent);
    const handler = new GCPAutoScaleHandler(platform);
    console.log('Calling Handler');
     // TODO: express deprecated res.send(status, body): Use res.status(status).send(body) instead
    callback = (err, data) => {
        console.log('Data', data.body);
        res.send(200, data.body);
    };
    return await handler.handle(req, context, callback);

};
async function getTables() {
    const dbCollection = Tables;
    return await dbCollection;

}

if (module === require.main) {
    exports.main(console.log);
}
