# FortiGate Autoscale
A collection of **Node.js** modules and cloud-specific templates which support autoscale functionality for groups of FortiGate-VM instances on various cloud platforms.

This project contains the code and templates for the **FortiGate Autoscale for GCP** deployment.
For autoscale on **AliCloud** see the [alicloud-autoscale](https://github.com/fortinet/alicloud-autoscale/) repository.
For autoscale on **Amazon AWS** and **Microsoft Azure** see the [fortigate-autoscale](https://github.com/fortinet/fortigate-autoscale/) repository.

## Supported Platforms
This project supports autoscale for the cloud platforms listed below.
  * Google Cloud Platform (GCP)

## Deployment

The deployment Guide is available from the Fortinet Document Library:

  * [ FortiGate / FortiOS Deploying Auto Scaling on GCP](https://docs.fortinet.com/vm/gc/fortigate/6.2/gcp-cookbook/6.2.0/365012/deploying-auto-scaling-on-gcp)

## Deployment Packages
To generate local deployment packages:

  1. Clone this project.
  2. Run `npm run setup` at the project root directory.


| File Name | Description |
| ------ | ------ |
| gcp-autoscale.zip | Source code for the GCP Auto Scaling handler - GCP Cloud Function|
| main.tf |  Terraform configuration file for GCP deployment |
| vars.tf |  Terraform configuration file for GCP deployment |


# Support
Fortinet-provided scripts in this and other GitHub projects do not fall under the regular Fortinet technical support scope and are not supported by FortiCare Support Services.
For direct issues, please refer to the [Issues](https://github.com/fortinet/fortigate-autoscale-gcp/issues) tab of this GitHub project.
For other questions related to this project, contact [github@fortinet.com](mailto:github@fortinet.com).

## License
[License](https://github.com/fortinet/fortigate-autoscale-gcp/blob/master/LICENSE) © Fortinet Technologies. All rights reserved.
