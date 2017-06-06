require('./BaseParser');
const inherits = require('util').inherits;

var Accessory, PlatformAccessory, Service, Characteristic, UUIDGen;

SingleSwitchParser = function(platform) {
	this.init(platform);
	
	Accessory = platform.Accessory;
	PlatformAccessory = platform.PlatformAccessory;
	Service = platform.Service;
	Characteristic = platform.Characteristic;
	UUIDGen = platform.UUIDGen;
}
inherits(SingleSwitchParser, BaseParser);

SingleSwitchParser.prototype.parse = function(json, rinfo) {
	this.platform.log.debug(JSON.stringify(json).trim());
	
	var data = JSON.parse(json['data']);
	var state0 = data['channel_0'];
	var voltage = data['voltage'] / 1.0;
	var lowBattery = this.getLowBatteryByVoltage(voltage);
	var batteryLevel = this.getBatteryLevelByVoltage(voltage);

	var equipmentSid = json['sid'];
	this.setSwitchAccessory(equipmentSid, state0, lowBattery, batteryLevel);
}

SingleSwitchParser.prototype.getUuidsByEquipmentSid = function(equipmentSid) {
	return [UUIDGen.generate('SingleSwitch' + equipmentSid)];
}

SingleSwitchParser.prototype.setSwitchAccessory = function(equipmentSid, state0, lowBattery, batteryLevel) {
	var uuid = UUIDGen.generate('SingleSwitch' + equipmentSid);
	var accessory = this.platform.getAccessoryByUuid(uuid);
	if(null == accessory) {
		var accessoryName = equipmentSid.substring(equipmentSid.length - 4);
		accessory = new PlatformAccessory(accessoryName, uuid, Accessory.Categories.SWITCH);
		accessory.reachable = true;

		accessory.getService(Service.AccessoryInformation)
			.setCharacteristic(Characteristic.Manufacturer, "Aqara")
			.setCharacteristic(Characteristic.Model, "Single Switch")
			.setCharacteristic(Characteristic.SerialNumber, equipmentSid);

		accessory.addService(Service.Switch, accessoryName);
		accessory.addService(Service.BatteryService, accessoryName);
		this.platform.api.registerPlatformAccessories("homebridge-mi-aqara", "MiAqaraPlatform", [accessory]);
		accessory.on('identify', function(paired, callback) {
			that.log(accessory.displayName, "Identify!!!");
			callback();
		});
		
		this.platform.accessories.push(accessory);
		this.platform.log.debug("create new accessories - UUID: " + uuid + ", type: Single Switch, equipmentSid: " + equipmentSid);
	}
	var switchService = accessory.getService(Service.Switch);
	var switchCharacteristic = switchService.getCharacteristic(Characteristic.On);
	if(state0 === 'on') {
		switchCharacteristic.updateValue(true);
	} else if(state0 === 'off') {
		switchCharacteristic.updateValue(false);
	} else {
	}
	
	if (switchCharacteristic.listeners('set').length == 0) {
		var that = this;
		switchCharacteristic.on("set", function(value, callback) {
			var key = that.platform.getWriteKeyByEquipmentSid(equipmentSid);
			var command = '{"cmd":"write","model":"ctrl_neutral1","sid":"' + equipmentSid + '","data":"{\\"channel_0\\":\\"' + (value ? 'on' : 'off') + '\\", \\"key\\": \\"' + key + '\\"}"}';
			that.platform.sendCommandByEquipmentSid(equipmentSid, command);
			
			callback();
		});
	}
	
	if(!isNaN(lowBattery) && !isNaN(batteryLevel)) {
		var batService = accessory.getService(Service.BatteryService);
		var lowBatCharacteristic = batService.getCharacteristic(Characteristic.StatusLowBattery);
		var batLevelCharacteristic = batService.getCharacteristic(Characteristic.BatteryLevel);
		var chargingStateCharacteristic = batService.getCharacteristic(Characteristic.ChargingState);
		lowBatCharacteristic.updateValue(lowBattery);
		batLevelCharacteristic.updateValue(batteryLevel);
		chargingStateCharacteristic.updateValue(true);
	}
}

