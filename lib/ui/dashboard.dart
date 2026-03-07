import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';

class Dashboard extends StatelessWidget {
  const Dashboard({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = Provider.of<AppState>(context);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Dashboard'), centerTitle: true),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              decoration: BoxDecoration(
                color: theme.colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Text(
                appState.activeNodeName,
                style: theme.textTheme.titleMedium,
              ),
            ),
            const SizedBox(height: 48),
            GestureDetector(
              onTap: () {
                appState.toggleConnection();
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                width: 200,
                height: 200,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: appState.isConnected
                        ? [Colors.redAccent, Colors.red]
                        : [Colors.deepPurpleAccent, Colors.deepPurple],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: appState.isConnected
                          ? Colors.red.withOpacity(0.4)
                          : Colors.deepPurple.withOpacity(0.4),
                      blurRadius: 20,
                      spreadRadius: 5,
                    ),
                  ],
                ),
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        appState.isConnected
                            ? Icons.power_settings_new
                            : Icons.rocket_launch,
                        size: 64,
                        color: Colors.white,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        appState.isConnected ? 'DISCONNECT' : 'TAP TO CONNECT',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.2,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 48),
            Text(
              'Status: ${appState.isConnected ? "Connected (System Proxy Active)" : "Disconnected"}',
              style: theme.textTheme.bodyLarge?.copyWith(
                color: appState.isConnected
                    ? Colors.green
                    : theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
