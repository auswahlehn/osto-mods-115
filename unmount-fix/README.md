## Unmount Fix
Tera-Proxy module for Tera Online. Fixes accidental dismounting immediately after mounting flying mount. This is caused by client freezing and flying mount's mount skill not sharing cooldown with dismount skill. This module prevents manual dismount for 300 ms after mounting.
### Requirements
[Tera-Proxy](https://github.com/meishuu/tera-proxy) and dependencies

The following opcodes must be mapped in your `tera-proxy/node_modules/tera-data/map/protocol.{version}.map` file:
* S_MOUNT_VEHICLE
* C_UNMOUNT_VEHICLE
