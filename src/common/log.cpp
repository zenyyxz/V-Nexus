#include "vnexus/common/log.hpp"
#include <spdlog/sinks/stdout_color_sinks.h>
#include <algorithm>

namespace vnexus::log {

void init(const std::string& level) {
    auto console_sink = std::make_shared<spdlog::sinks::stdout_color_sink_mt>();
    console_sink->set_pattern("[%Y-%m-%d %H:%M:%S.%e] [%^%l%$] %v");

    auto logger = std::make_shared<spdlog::logger>("vnexus", console_sink);
    spdlog::set_default_logger(logger);
    set_level(level);
}

void set_level(const std::string& level_str) {
    std::string lvl = level_str;
    std::transform(lvl.begin(), lvl.end(), lvl.begin(), [](unsigned char c) { return std::tolower(c); });

    if (lvl == "trace") {
        spdlog::set_level(spdlog::level::trace);
    } else if (lvl == "debug") {
        spdlog::set_level(spdlog::level::debug);
    } else if (lvl == "info") {
        spdlog::set_level(spdlog::level::info);
    } else if (lvl == "warn" || lvl == "warning") {
        spdlog::set_level(spdlog::level::warn);
    } else if (lvl == "error") {
        spdlog::set_level(spdlog::level::err);
    } else {
        spdlog::set_level(spdlog::level::info);
    }
}

} // namespace vnexus::log
