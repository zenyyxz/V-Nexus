#pragma once

#include "vnexus/sniff/sniffer.hpp"

namespace vnexus::sniff {

class HttpSniffer : public ISniffer {
public:
    [[nodiscard]] std::string_view name() const override { return "http"; }
    [[nodiscard]] SniffResult sniff(std::span<const uint8_t> buffer) const override;
};

} // namespace vnexus::sniff
