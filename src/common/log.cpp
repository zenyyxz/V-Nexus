#include "vnexus/common/log.hpp"
#include <spdlog/sinks/stdout_color_sinks.h>
#include <spdlog/sinks/basic_file_sink.h>
#include <algorithm>
#include <vector>

namespace vnexus::log {

void init(const std::string& level, const std::string& file_path, bool timestamp) {
    std::vector<spdlog::sink_ptr> sinks;

    std::string pattern = timestamp ? "[%Y-%m-%d %H:%M:%S.%e] [%^%l%$] %v" : "[%^%l%$] %v";

    auto console_sink = std::make_shared<spdlog::sinks::stdout_color_sink_mt>();
    console_sink->set_pattern(pattern);
    sinks.push_back(console_sink);

    if (!file_path.empty()) {
        try {
            auto file_sink = std::make_shared<spdlog::sinks::basic_file_sink_mt>(file_path, false);
            file_sink->set_pattern(pattern);
            sinks.push_back(file_sink);
        } catch (const std::exception& e) {
            fprintf(stderr, "Failed to open log file '%s': %s\n", file_path.c_str(), e.what());
        }
    }

    auto logger = std::make_shared<spdlog::logger>("vnexus", sinks.begin(), sinks.end());
    logger->flush_on(spdlog::level::trace); // Always flush immediately to disk
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
