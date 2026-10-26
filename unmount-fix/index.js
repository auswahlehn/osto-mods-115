module.exports = function mountFix(dispatch) {
	// variables
	let mountTime = 0
	
	dispatch.hook('S_MOUNT_VEHICLE', 'raw', {order: -100, filters: {fake: null}}, code => {
		mountTime = Date.now()
	})
	
	dispatch.hook('C_UNMOUNT_VEHICLE', 'raw', {order: -100}, code => {
		if ((Date.now() - mountTime) < 300) {
			return false
		}
	})

	dispatch.hook('C_START_SKILL', 'raw', {order: -100}, code => {
		if ((Date.now() - mountTime) < 300) {
			return false
		}
	})
}