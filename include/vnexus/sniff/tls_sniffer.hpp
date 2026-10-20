#pragma once

#include "vnexus/sniff/sniffer.hpp"

namespace vnexus::sniff {

class TlsSniffer : public ISniffer {
public:
    [[nodiscard]] std::string_view name() const override { return "tls"; }
    [[nodiscard]] SniffResult sniff(std::span<const uint8_t> buffer) const override;
};

} // namespace vnexus::sniff
