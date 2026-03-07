import 'dart:ffi';
import 'package:ffi/ffi.dart';
import 'dart:io';

typedef StartSingboxC = Int32 Function(Pointer<Utf8> configJsonPath);
typedef StartSingboxDart = int Function(Pointer<Utf8> configJsonPath);

typedef StopSingboxC = Int32 Function(Int32 pid);
typedef StopSingboxDart = int Function(int pid);

typedef EnableSystemProxyC = Int32 Function(Pointer<Utf8> ip, Int32 port);
typedef EnableSystemProxyDart = int Function(Pointer<Utf8> ip, int port);

typedef DisableSystemProxyC = Int32 Function();
typedef DisableSystemProxyDart = int Function();

class NativeBackend {
  late DynamicLibrary _lib;
  late StartSingboxDart _startSingbox;
  late StopSingboxDart _stopSingbox;
  late EnableSystemProxyDart _enableSystemProxy;
  late DisableSystemProxyDart _disableSystemProxy;

  NativeBackend() {
    // Determine the library path based on OS
    // For development, we assume running from the project root on Linux
    String libPath = '';
    if (Platform.isLinux) {
      libPath =
          '${Directory.current.path}/native_backend/build/libnative_backend.so';
    } else {
      throw UnsupportedError(
        'Only Linux is currently supported for native backend',
      );
    }

    _lib = DynamicLibrary.open(libPath);

    _startSingbox = _lib
        .lookup<NativeFunction<StartSingboxC>>('start_singbox')
        .asFunction();

    _stopSingbox = _lib
        .lookup<NativeFunction<StopSingboxC>>('stop_singbox')
        .asFunction();

    _enableSystemProxy = _lib
        .lookup<NativeFunction<EnableSystemProxyC>>('enable_system_proxy')
        .asFunction();

    _disableSystemProxy = _lib
        .lookup<NativeFunction<DisableSystemProxyC>>('disable_system_proxy')
        .asFunction();
  }

  int startSingbox(String configJsonPath) {
    final pathPtr = configJsonPath.toNativeUtf8();
    final pid = _startSingbox(pathPtr);
    malloc.free(pathPtr);
    return pid;
  }

  int stopSingbox(int pid) {
    return _stopSingbox(pid);
  }

  int enableSystemProxy(String ip, int port) {
    final ipPtr = ip.toNativeUtf8();
    final result = _enableSystemProxy(ipPtr, port);
    malloc.free(ipPtr);
    return result;
  }

  int disableSystemProxy() {
    return _disableSystemProxy();
  }
}

final nativeBackend = NativeBackend();
