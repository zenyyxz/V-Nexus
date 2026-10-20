#include <iostream>
#include "cli.hpp"
#include "config_serializer.hpp"

int main(int argc, char* argv[]) {
    VNexus::CLI::CLIParser parser(argc, argv);
    VNexus::Core::ConfigAttributes config;

    if (parser.hasCommand("-h") || parser.hasCommand("--help")) {
        parser.printHelp();
    } 

    if (parser.hasCommand("-S") || parser.hasCommand("--remote-server-domain")) {
        config.server = parser.getOption({"-S", "--remote-server-domain"});
    }
    
    return 0;
}