variable "region" {
    type = "string"
    default = "us-central1" //Default Region
}
variable "project" {
  type = "string"
  default = ""
}
variable "vpc_cidr"{
    type = "string"
    default = "172.16.0.0/16"
}

variable "vswitch_cidr_1"{
    type = "string"
    default = "172.16.0.0/21"
}
variable "vswitch_cidr_2"{
    type = "string"
    default = "172.16.8.0/21"
}

//CPU threshold to scale in or out
variable "scale_in_threshold"{
    type = "string"
    default = 35
}
variable "scale_out_threshold"{
    type = "string"
    default = 70
}
//Retrieves the current account for use with Function Compute

variable "cluster_name"{
    type = "string"
    default = "FortigateAutoScale"
}

//OSS Bucket Name MUST be lowercase
variable "bucket_name"{
    type = "string"
    default = "fortigateautoscale"
}

//Define the instance family to be used.
//Different regions will contain various instance families
//default family : ecs.sn2ne
variable "instance" {
    type = "string"
    default = "n1-standard-1"
}
