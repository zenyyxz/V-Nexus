cmake_minimum_required(VERSION 3.20)
project(vnexus-engine VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Compiler options
if(MSVC)
    add_compile_options(/W4 /permissive-)
else()
    add_compile_options(-Wall -Wextra -Wpedantic -O2)
endif()

# Find dependencies
find_package(OpenSSL REQUIRED)
find_package(nlohmann_json REQUIRED)
find_package(fmt REQUIRED)
find_package(spdlog REQUIRED)
find_package(Threads REQUIRED)
find_package(Catch2 3 QUIET)

# Include directories
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

# Core library sources
set(CORE_SOURCES
    src/common/log.cpp
    src/common/net.cpp
    src/common/uuid.cpp
    src/config/config.cpp
    src/sniff/sniffer.cpp
    src/sniff/tls_sniffer.cpp
    src/sniff/http_sniffer.cpp
    src/router/router.cpp
    src/inbound/inbound.cpp
    src/inbound/socks5_inbound.cpp
    src/inbound/http_inbound.cpp
    src/inbound/mixed_inbound.cpp
    src/inbound/tun_inbound.cpp
    src/outbound/outbound.cpp
    src/outbound/direct_outbound.cpp
    src/outbound/block_outbound.cpp
    src/outbound/vless_outbound.cpp
    src/outbound/vmess_outbound.cpp
    src/engine.cpp
)

add_library(vnexus_core STATIC ${CORE_SOURCES})

target_link_libraries(vnexus_core PUBLIC
    OpenSSL::SSL
    OpenSSL::Crypto
    nlohmann_json::nlohmann_json
    fmt::fmt
    spdlog::spdlog
    Threads::Threads
)

target_compile_definitions(vnexus_core PUBLIC
    ASIO_STANDALONE
    ASIO_NO_DEPRECATED
)

# Main executable
add_executable(vnexus cmd/main.cpp)
target_link_libraries(vnexus PRIVATE vnexus_core)

# Tests
if(Catch2_FOUND)
    enable_testing()
    add_executable(vnexus_tests
        tests/test_main.cpp
        tests/test_sniffer.cpp
        tests/test_vless.cpp
        tests/test_vmess.cpp
        tests/test_socks5.cpp
        tests/test_router.cpp
    )
    target_link_libraries(vnexus_tests PRIVATE vnexus_core Catch2::Catch2WithMain)
    add_test(NAME vnexus_tests COMMAND vnexus_tests)
endif()
