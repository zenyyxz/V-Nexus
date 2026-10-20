#include "vnexus/engine.hpp"
#include "vnexus/common/log.hpp"
#include <iostream>
#include <string>
#include <csignal>

void print_banner() {
    std::cout << R"(
 __     __ _   _                        ______             _             
 \ \   / /| \ | |                      |  ____|           (_)            
  \ \_/ / |  \| |  ___ __  __ _   _  ___| |__   _ __   __ _ _ _ __   ___ 
   \   /  | . ` | / _ \\ \/ /| | | |/ __|  __| | '_ \ / _` | | '_ \ / _ \
    | |   | |\  ||  __/ >  < | |_| |\__ \ |____| | | | (_| | | | | |  __/
    |_|   |_| \_| \___|/_/\_\ \__,_||___/______|_| |_|\__, |_|_| |_|\___|
                                                        __/ |            
                                                       |___/             
    vnexus-engine - High Performance C++ VPN Core with SNI Sniffing
    Version: 1.0.0
)" << std::endl;
}

void print_help(const char* prog) {
    std::cout << "Usage: " << prog << " [options]\n\n"
              << "Options:\n"
              << "  -c, --config <path>    Path to JSON configuration file (default: config.json)\n"
              << "  -t, --test             Test and validate configuration file without running\n"
              << "  -v, --version          Display version information\n"
              << "  -h, --help             Display this help message\n";
}

int main(int argc, char* argv[]) {
    std::string config_path = "config.json";
    bool test_mode = false;

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "-c" || arg == "--config") {
            if (i + 1 < argc) {
                config_path = argv[++i];
            } else {
                std::cerr << "Error: --config requires a file path argument.\n";
                return 1;
            }
        } else if (arg == "-t" || arg == "--test") {
            test_mode = true;
        } else if (arg == "-v" || arg == "--version") {
            print_banner();
            return 0;
        } else if (arg == "-h" || arg == "--help") {
            print_banner();
            print_help(argv[0]);
            return 0;
        } else {
            std::cerr << "Unknown option: " << arg << "\n";
            print_help(argv[0]);
            return 1;
        }
    }

    try {
        vnexus::log::init("info");
        auto config = vnexus::config::Config::load_from_file(config_path);

        if (test_mode) {
            std::cout << "Configuration file '" << config_path << "' is valid." << std::endl;
            return 0;
        }

        print_banner();
        VN_INFO("[main] Loading configuration from '{}'...", config_path);
        vnexus::Engine engine(config);

        // Setup signal handling for clean exit
        asio::signal_set signals(engine.io_context(), SIGINT, SIGTERM);
        signals.async_wait([&engine](std::error_code /*ec*/, int signo) {
            VN_INFO("[main] Received signal {}, shutting down...", signo);
            engine.stop();
        });

        VN_INFO("[main] Starting vnexus-engine...");
        engine.run();

    } catch (const std::exception& ex) {
        std::cerr << "Fatal error: " << ex.what() << std::endl;
        return 1;
    }

    return 0;
}
