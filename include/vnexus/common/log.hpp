#pragma once

#include <spdlog/spdlog.h>
#include <string>
#include <memory>

namespace vnexus::log {

void init(const std::string& level = "info");
void set_level(const std::string& level);

} // namespace vnexus::log

#define VN_TRACE(...) spdlog::trace(__VA_ARGS__)
#define VN_DEBUG(...) spdlog::debug(__VA_ARGS__)
#define VN_INFO(...)  spdlog::info(__VA_ARGS__)
#define VN_WARN(...)  spdlog::warn(__VA_ARGS__)
#define VN_ERROR(...) spdlog::error(__VA_ARGS__)
