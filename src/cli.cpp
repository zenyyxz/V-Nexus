#include "cli.hpp"
#include <iostream>

VNexus::CLI::CLIParser::CLIParser(int argc, char* argv[]) {
    for (int i{1}; i < argc; ++i) {
        args_.emplace_back(argv[i]);
    }
}

bool VNexus::CLI::CLIParser::hasCommand(const std::string& cmd) const {
    for (const auto &arg : args_) {
        if (arg == cmd) {
            return true;
        }
    }
    return false;
}

void VNexus::CLI::CLIParser::printHelp() const {
    std::cout << "Usage: vnexus [options...] [args]\n\n";
    std::cout << "Options:\n";
    std::cout << "-h or --help: get this help menu.\n";
}