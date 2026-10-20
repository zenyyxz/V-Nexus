#include <iostream>
#include "cli.hpp"
#include "config_serializer.hpp"

int main(int argc, char* argv[]) {
    VNexus::CLI::CLIParser parser(argc, argv);
    VNexus::Core::ConfigAttributes config;

    if (parser.hasCommand("-h") || parser.hasCommand("--help")) {
        parser.printHelp();
    } else {
        std::cerr << "Unknown command. Use -h or --help for the usage information.\n";
    }

    if (parser.hasCommand("-S") || parser.hasCommand("--remote-server-domain")) {
        config.server = args_[(args_.find("-S") || args_.find("--remote-server-domain") + 1 )];
        std::cout << "remote server domain: " << config.server << std::endl;
    }

    return 0;
}