#pragma once

#include <vector>
#include <string>

namespace VNexus {
    namespace CLI {
        class CLIParser {
            public:
            CLIParser(int argc, char* argv[]);

            bool hasCommand(const std::string &cmd) const;
            std::string getOption(const std::string &flag) const;
            void printHelp() const;

            private:
            std::vector<std::string> args_;
        };
    } // namespace CLI
} // namespace VNexus