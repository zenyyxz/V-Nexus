import 'package:flutter/material.dart';

class Settings extends StatelessWidget {
  const Settings({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: [
          SwitchListTile(
            title: const Text('System Proxy'),
            subtitle: const Text('Automatically configure OS proxy settings'),
            value: true,
            onChanged: (bool value) {},
          ),
          SwitchListTile(
            title: const Text('Tun Mode'),
            subtitle: const Text(
              'Capture all traffic via virtual network interface',
            ),
            value: false,
            onChanged: (bool value) {},
          ),
          ListTile(
            title: const Text('Routing Rules'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {},
          ),
        ],
      ),
    );
  }
}
