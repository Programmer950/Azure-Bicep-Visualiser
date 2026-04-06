param location string = 'eastus'

// 1. The Virtual Network & Subnet
resource myVnet 'Microsoft.Network/virtualNetworks@2023-04-01' = {
  name: 'core-vnet'
  location: location
  properties: {
    addressSpace: { addressPrefixes: ['10.0.0.0/16'] }
    subnets: [
      {
        name: 'frontend-subnet'
        properties: { addressPrefix: '10.0.1.0/24' }
      }
    ]
  }
}

// 2. The Public IP Address
resource myPublicIp 'Microsoft.Network/publicIPAddresses@2023-04-01' = {
  name: 'vm-public-ip'
  location: location
  sku: { name: 'Standard' }
  properties: { publicIPAllocationMethod: 'Static' }
}

// 3. The Network Interface (NIC)
// Notice how this connects to both the VNet and the Public IP!
resource myNic 'Microsoft.Network/networkInterfaces@2023-04-01' = {
  name: 'vm-nic'
  location: location
  properties: {
    ipConfigurations: [
      {
        name: 'ipconfig1'
        properties: {
          privateIPAllocationMethod: 'Dynamic'

          // CONNECTION A: Linking to the Subnet
          subnet: { id: myVnet.properties.subnets[0].id }

          // CONNECTION B: Linking to the Public IP
          publicIPAddress: { id: myPublicIp.id }
        }
      }
    ]
  }
}

// 4. The Virtual Machine
resource myVm 'Microsoft.Compute/virtualMachines@2023-03-01' = {
  name: 'frontend-vm'
  location: location
  properties: {
    hardwareProfile: { vmSize: 'Standard_B2s' }
    networkProfile: {
      networkInterfaces: [

        // CONNECTION C: Linking the VM to the NIC
        { id: myNic.id }

      ]
    }
    // (OS and Storage profiles omitted for brevity)
  }
}