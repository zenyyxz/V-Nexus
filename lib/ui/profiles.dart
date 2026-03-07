import 'package:flutter/material.dart';

class Profiles extends StatelessWidget {
  const Profiles({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profiles'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () {
              // Add new profile logic
            },
          ),
        ],
      ),
      body: ListView.builder(
        itemCount: 1, // Placeholder
        itemBuilder: (context, index) {
          return ListTile(
            leading: const Icon(Icons.storage),
            title: const Text('Dummy Vless Node'),
            subtitle: const Text('vless://... -> example.com:443'),
            trailing: IconButton(
              icon: const Icon(Icons.more_vert),
              onPressed: () {},
            ),
          );
        },
      ),
    );
  }
}
