#include "backend.h"
#include <cstdlib>
#include <iostream>
#include <string>

#ifdef __linux__
#include <signal.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>
#endif

extern "C" {

const char *get_backend_version() { return "1.0.0"; }

int start_singbox(const char *config_json_path) {
#ifdef __linux__
  pid_t pid = fork();
  if (pid == 0) {
    // Child process
    // Replace current image with sing-box
    execlp("sing-box", "sing-box", "run", "-c", config_json_path, NULL);
    // If execlp returns, an error occurred
    std::cerr << "Failed to start sing-box (ensure sing-box is in PATH)"
              << std::endl;
    exit(1);
  } else if (pid > 0) {
    // Parent process
    return pid;
  } else {
    // Fork failed
    return -1;
  }
#else
  std::cout << "start_singbox not fully implemented for this OS yet.\n";
  return -1;
#endif
}

int stop_singbox(int pid) {
#ifdef __linux__
  if (pid > 0) {
    return kill(pid, SIGTERM);
  }
  return -1;
#else
  return -1;
#endif
}

int enable_system_proxy(const char *ip, int port) {
#ifdef __linux__
  std::string set_mode = "gsettings set org.gnome.system.proxy mode 'manual'";
  std::string set_host =
      std::string("gsettings set org.gnome.system.proxy.socks host '") + ip +
      "'";
  std::string set_port =
      std::string("gsettings set org.gnome.system.proxy.socks port ") +
      std::to_string(port);
  std::string set_http_host =
      std::string("gsettings set org.gnome.system.proxy.http host '") + ip +
      "'";
  std::string set_http_port =
      std::string("gsettings set org.gnome.system.proxy.http port ") +
      std::to_string(port);
  std::string set_https_host =
      std::string("gsettings set org.gnome.system.proxy.https host '") + ip +
      "'";
  std::string set_https_port =
      std::string("gsettings set org.gnome.system.proxy.https port ") +
      std::to_string(port);

  system(set_mode.c_str());
  system(set_host.c_str());
  system(set_port.c_str());
  system(set_http_host.c_str());
  system(set_http_port.c_str());
  system(set_https_host.c_str());
  system(set_https_port.c_str());

  return 0;
#else
  return -1;
#endif
}

int disable_system_proxy() {
#ifdef __linux__
  system("gsettings set org.gnome.system.proxy mode 'none'");
  return 0;
#else
  return -1;
#endif
}
}
