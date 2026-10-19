#include <iostream>
#include "cli.hpp"

int main(int argc, char* argv[]) {
    VNexus::CLI::CLIParser parser(argc, argv);

    if (parser.hasCommand("-h") || parser.hasCommand("--help")) {
        parser.printHelp();
    } else {
        std::cerr << "Unknown command. Use -h or --help for the usage information.\n";
    }

    return 0;
}