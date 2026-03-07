import 'package:flutter/foundation.dart';
import '../native_backend.dart';
import 'dart:io';

class AppState extends ChangeNotifier {
  bool _isConnected = false;
  int _singboxPid = -1;
  String _activeNodeName = "No Node Selected";

  bool get isConnected => _isConnected;
  String get activeNodeName => _activeNodeName;

  void toggleConnection() async {
    if (_isConnected) {
      if (_singboxPid > 0) {
        nativeBackend.stopSingbox(_singboxPid);
        _singboxPid = -1;
      }
      nativeBackend.disableSystemProxy();
      _isConnected = false;
    } else {
      // Create a dummy config just to test singbox spawning
      // In reality, this would serialize the active profile
      final tempDir = Directory.systemTemp;
      final configPath = '${tempDir.path}/singbox_config.json';
      File(configPath).writeAsStringSync(
        '{"log": {"level": "info"}}',
      ); // minimal valid json for sing-box

      _singboxPid = nativeBackend.startSingbox(configPath);
      // Wait a moment for sing-box to start
      await Future.delayed(const Duration(milliseconds: 500));

      // Assume local proxy is running on 1080
      nativeBackend.enableSystemProxy('127.0.0.1', 1080);
      _isConnected = true;
    }
    notifyListeners();
  }
}
