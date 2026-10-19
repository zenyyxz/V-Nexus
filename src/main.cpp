#include <iostream>
#include "cli.hpp"
#include "config_serializer.hpp"

int main(int argc, char* argv[]) {
    VNexus::CLI::CLIParser parser(argc, argv);

    /* if (parser.hasCommand("-h") || parser.hasCommand("--help")) {
        parser.printHelp();
    } else {
        std::cerr << "Unknown command. Use -h or --help for the usage information.\n";
    } */

    VNexus::Core::ConfigAttributes config;
    VNexus::Core::SaveConfigFile(config, "/home/zendx/Documents/vnexus/");

    std::cout << "generated shit";

    return 0;
}