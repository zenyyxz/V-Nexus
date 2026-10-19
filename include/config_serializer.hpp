#pragma once

#include <string>
#include "config.hpp"

namespace VNexus {
    namespace Core {

        // i'm using free functions to generate the config.json, don't know if there's a better efficient way.
        std::string GenerateSingBoxConfig(const ConfigAttributes &config);

        bool SaveConfigFile(const ConfigAttributes &config, const std::string &filapath);

    } // namespace Core
} // namespace VNexus