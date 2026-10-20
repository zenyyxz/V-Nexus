#include "vnexus/sniff/sniffer.hpp"
#include "vnexus/sniff/tls_sniffer.hpp"
#include "vnexus/sniff/http_sniffer.hpp"
#include <algorithm>

namespace vnexus::sniff {

CompositeSniffer::CompositeSniffer() {
    add_sniffer(std::make_shared<TlsSniffer>());
    add_sniffer(std::make_shared<HttpSniffer>());
}

CompositeSniffer::CompositeSniffer(const std::vector<std::string>& protocols) {
    for (const auto& proto : protocols) {
        std::string p = proto;
        std::transform(p.begin(), p.end(), p.begin(), [](unsigned char c) { return std::tolower(c); });
        if (p == "tls") {
            add_sniffer(std::make_shared<TlsSniffer>());
        } else if (p == "http") {
            add_sniffer(std::make_shared<HttpSniffer>());
        }
    }
}

void CompositeSniffer::add_sniffer(std::shared_ptr<ISniffer> sniffer) {
    if (sniffer) {
        sniffers_.push_back(std::move(sniffer));
    }
}

SniffResult CompositeSniffer::sniff(std::span<const uint8_t> buffer) const {
    for (const auto& s : sniffers_) {
        auto res = s->sniff(buffer);
        if (res.success) {
            return res;
        }
    }
    return SniffResult{.success = false, .protocol = "", .domain = "", .port = 0};
}

} // namespace vnexus::sniff
