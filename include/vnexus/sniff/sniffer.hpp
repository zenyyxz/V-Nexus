#pragma once

#include "vnexus/common/types.hpp"
#include <string_view>
#include <vector>
#include <memory>
#include <span>

namespace vnexus::sniff {

class ISniffer {
public:
    virtual ~ISniffer() = default;
    [[nodiscard]] virtual std::string_view name() const = 0;
    [[nodiscard]] virtual SniffResult sniff(std::span<const uint8_t> buffer) const = 0;
};

class CompositeSniffer {
public:
    CompositeSniffer();
    explicit CompositeSniffer(const std::vector<std::string>& protocols);

    void add_sniffer(std::shared_ptr<ISniffer> sniffer);
    
    // Attempt sniffing across registered sniffers
    [[nodiscard]] SniffResult sniff(std::span<const uint8_t> buffer) const;

private:
    std::vector<std::shared_ptr<ISniffer>> sniffers_;
};

} // namespace vnexus::sniff
