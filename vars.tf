variable "region" {
    type = "string"
    default = "us-central1" #Default Region
}
variable "project" {
  type = "string"
  default = ""
}
variable "vpc_cidr"{
    type = "string"
    default = "172.16.0.0/16"
}

variable "public_subnet"{
    type = "string"
    default = "172.16.0.0/21"
}
variable "protected_subnet"{
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

#Must be lower-case for VPC
variable "cluster_name"{
    type = "string"
    default = "fortigateautoscale"
}

#Must be all lower case
variable "bucket_name"{
    type = "string"
    default = "fortigateautoscale"
}
#Default n1-standard-1
variable "instance" {
    type = "string"
    default = "n1-standard-1"
}
