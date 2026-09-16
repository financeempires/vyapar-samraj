package com.vyaparsamraj.service;

import com.vyaparsamraj.entity.Area;
import com.vyaparsamraj.entity.Customer;
import com.vyaparsamraj.entity.CustomerPayment;
import com.vyaparsamraj.exception.ConflictException;
import com.vyaparsamraj.exception.ResourceNotFoundException;
import com.vyaparsamraj.repository.AreaRepository;
import com.vyaparsamraj.repository.CustomerPaymentRepository;
import com.vyaparsamraj.repository.CustomerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final AreaRepository areaRepository;
    private final CustomerPaymentRepository paymentRepository;

    public boolean checkSerialNumberExists(UUID userId, Integer serialNumber) {
        if (serialNumber == null) return false;
        return customerRepository.findByUserIdAndSerialNumber(userId, serialNumber).isPresent();
    }

    public Map<String, Object> getCustomerById(UUID userId, UUID customerId) {
        Customer customer = customerRepository.findByIdAndUserId(customerId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found or access denied"));

        String areaName = null;
        if (customer.getAreaId() != null) {
            areaName = areaRepository.findById(customer.getAreaId()).map(Area::getName).orElse(null);
        }

        BigDecimal paid = paymentRepository.sumAmountByCustomerIdMainLoan(customerId);
        if (paid == null) paid = BigDecimal.ZERO;

        BigDecimal totalAmount = customer.getTotalAmount() != null ? customer.getTotalAmount() : BigDecimal.ZERO;
        BigDecimal balance = totalAmount.subtract(paid).max(BigDecimal.ZERO);

        List<CustomerPayment> payments = paymentRepository.findByCustomerIdOrderByCreatedAtAscIdAsc(customerId);

        Map<String, Object> dueInfo = calculateDueRemaining(customer.getGivenDate(), customer.getLastDate(), customer.getSection());

        Map<String, Object> customerMap = new LinkedHashMap<>();
        customerMap.put("id", customer.getId());
        customerMap.put("user_id", customer.getUserId());
        customerMap.put("area_id", customer.getAreaId());
        customerMap.put("area_name", areaName);
        customerMap.put("section", customer.getSection() != null ? customer.getSection().toUpperCase() : "DAILY");
        customerMap.put("name", customer.getName());
        customerMap.put("phone", customer.getPhone());
        customerMap.put("phone_number", customer.getPhoneNumber() != null ? customer.getPhoneNumber() : customer.getPhone());
        customerMap.put("photo_url", customer.getPhotoUrl());
        customerMap.put("serial_number", customer.getSerialNumber());
        customerMap.put("address", customer.getAddress());
        customerMap.put("latitude", customer.getLatitude());
        customerMap.put("longitude", customer.getLongitude());
        customerMap.put("alternative_number", customer.getAlternativeNumber());
        customerMap.put("referral_name", customer.getReferralName());
        customerMap.put("referral_number", customer.getReferralNumber());
        customerMap.put("given_amount", customer.getGivenAmount());
        customerMap.put("interest_amount", customer.getInterestAmount());
        customerMap.put("total_amount", customer.getTotalAmount());
        customerMap.put("installment_amount", customer.getInstallmentAmount());
        customerMap.put("given_date", customer.getGivenDate());
        customerMap.put("last_date", customer.getLastDate());
        customerMap.put("notes_taken", customer.getNotesTaken());
        customerMap.put("cheque_taken", customer.getChequeTaken());
        customerMap.put("notes", customer.getNotes());
        customerMap.put("cheque_details", customer.getChequeDetails());
        customerMap.put("additional_details", customer.getAdditionalDetails());
        customerMap.put("is_marked", customer.getIsMarked());
        customerMap.put("is_flagged", customer.getIsFlagged());
        customerMap.put("given_payment_method", customer.getGivenPaymentMethod());
        customerMap.put("duration_type", customer.getDurationType());
        customerMap.put("status", customer.getStatus() != null ? customer.getStatus() : "ACTIVE");
        customerMap.put("paid", paid);
        customerMap.put("balance", balance);
        customerMap.put("due_remaining", dueInfo.get("text"));
        customerMap.put("due_remaining_is_late", dueInfo.get("isLate"));
        customerMap.put("payments", payments);
        customerMap.put("created_at", customer.getCreatedAt());
        customerMap.put("updated_at", customer.getUpdatedAt());

        return customerMap;
    }

    public List<Map<String, Object>> getCustomersByArea(UUID userId, UUID areaId, String section) {
        Area area = areaRepository.findByIdAndUserId(areaId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Area not found or access denied"));

        List<Customer> customers;
        if (section != null && !section.trim().isEmpty()) {
            customers = customerRepository.findByUserIdAndAreaIdAndSection(userId, areaId, section.trim().toLowerCase());
        } else {
            customers = customerRepository.findByUserIdAndAreaId(userId, areaId);
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Customer c : customers) {
            BigDecimal paid = paymentRepository.sumAmountByCustomerIdMainLoan(c.getId());
            if (paid == null) paid = BigDecimal.ZERO;

            BigDecimal totalAmount = c.getTotalAmount() != null ? c.getTotalAmount() : BigDecimal.ZERO;
            BigDecimal balance = totalAmount.subtract(paid).max(BigDecimal.ZERO);

            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", c.getId());
            map.put("user_id", c.getUserId());
            map.put("area_id", c.getAreaId());
            map.put("section", c.getSection() != null ? c.getSection().toUpperCase() : "DAILY");
            map.put("name", c.getName());
            map.put("phone", c.getPhone());
            map.put("phone_number", c.getPhoneNumber() != null ? c.getPhoneNumber() : c.getPhone());
            map.put("photo_url", c.getPhotoUrl());
            map.put("serial_number", c.getSerialNumber());
            map.put("address", c.getAddress());
            map.put("latitude", c.getLatitude());
            map.put("longitude", c.getLongitude());
            map.put("alternative_number", c.getAlternativeNumber());
            map.put("referral_name", c.getReferralName());
            map.put("referral_number", c.getReferralNumber());
            map.put("given_amount", c.getGivenAmount());
            map.put("interest_amount", c.getInterestAmount());
            map.put("total_amount", c.getTotalAmount());
            map.put("installment_amount", c.getInstallmentAmount());
            map.put("given_date", c.getGivenDate());
            map.put("last_date", c.getLastDate());
            map.put("notes_taken", c.getNotesTaken());
            map.put("cheque_taken", c.getChequeTaken());
            map.put("additional_details", c.getAdditionalDetails());
            map.put("is_marked", c.getIsMarked());
            map.put("is_flagged", c.getIsFlagged());
            map.put("given_payment_method", c.getGivenPaymentMethod());
            map.put("duration_type", c.getDurationType());
            map.put("status", c.getStatus() != null ? c.getStatus() : "ACTIVE");
            map.put("paid", paid);
            map.put("balance", balance);
            map.put("created_at", c.getCreatedAt());
            map.put("updated_at", c.getUpdatedAt());

            result.add(map);
        }

        return result;
    }

    @Transactional
    public Customer createCustomer(UUID userId, Map<String, Object> body, String verifiedByName, String verifiedByEmail) {
        String name = body.get("name") != null ? String.valueOf(body.get("name")).trim() : "";
        String phone = body.get("phone") != null ? String.valueOf(body.get("phone")).trim() : 
                (body.get("phone_number") != null ? String.valueOf(body.get("phone_number")).trim() : "");
        String areaIdStr = body.get("area_id") != null ? String.valueOf(body.get("area_id")).trim() : "";

        if (name.isEmpty()) throw new IllegalArgumentException("Customer name is required");
        if (phone.isEmpty()) throw new IllegalArgumentException("Phone number is required");
        if (areaIdStr.isEmpty()) throw new IllegalArgumentException("Area ID is required");

        UUID areaId = UUID.fromString(areaIdStr);
        Area area = areaRepository.findByIdAndUserId(areaId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Area not found or access denied"));

        Integer serialNumber = parseInteger(body.get("serial_number"));
        if (serialNumber != null) {
            if (customerRepository.findByUserIdAndSerialNumber(userId, serialNumber).isPresent()) {
                throw new ConflictException("Serial number " + serialNumber + " already exists. Please select another number.");
            }
        }

        String rawSection = body.get("section") != null ? String.valueOf(body.get("section")).trim().toLowerCase() : "daily";
        String section = (rawSection.equals("weekly") || rawSection.equals("monthly")) ? rawSection : "daily";

        BigDecimal installmentAmount = parseBigDecimal(body.get("installment_amount"));
        if (installmentAmount == null) {
            throw new IllegalArgumentException("Installment amount is required");
        }

        BigDecimal givenAmount = parseBigDecimal(body.get("given_amount"));
        BigDecimal interestAmount = parseBigDecimal(body.get("interest_amount"));
        BigDecimal totalAmount = parseBigDecimal(body.get("total_amount"));
        if (totalAmount == null && (givenAmount != null || interestAmount != null)) {
            BigDecimal g = givenAmount != null ? givenAmount : BigDecimal.ZERO;
            BigDecimal i = interestAmount != null ? interestAmount : BigDecimal.ZERO;
            totalAmount = g.add(i);
        }

        Customer customer = Customer.builder()
                .userId(userId)
                .areaId(areaId)
                .section(section)
                .name(name)
                .phone(phone)
                .phoneNumber(phone)
                .photoUrl(parseString(body.get("photo_url")))
                .serialNumber(serialNumber)
                .address(parseString(body.get("address")))
                .latitude(parseBigDecimal(body.get("latitude")))
                .longitude(parseBigDecimal(body.get("longitude")))
                .alternativeNumber(parseString(body.get("alternative_number")))
                .referralName(parseString(body.get("referral_name")))
                .referralNumber(parseString(body.get("referral_number")))
                .givenAmount(givenAmount)
                .interestAmount(interestAmount)
                .totalAmount(totalAmount)
                .installmentAmount(installmentAmount)
                .givenDate(parseLocalDate(body.get("given_date")))
                .lastDate(parseLocalDate(body.get("last_date")))
                .notesTaken(Boolean.TRUE.equals(body.get("notes_taken")))
                .chequeTaken(Boolean.TRUE.equals(body.get("cheque_taken")))
                .additionalDetails(parseString(body.get("additional_details")))
                .verifiedByUserId(userId)
                .verifiedByName(verifiedByName)
                .verifiedByEmail(verifiedByEmail)
                .verifiedAt(OffsetDateTime.now())
                .isMarked(false)
                .isFlagged(false)
                .status("ACTIVE")
                .build();

        return customerRepository.save(customer);
    }

    @Transactional
    public Customer updateCustomerMarked(UUID userId, UUID customerId, Boolean explicitMarked) {
        Customer customer = customerRepository.findByIdAndUserId(customerId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found or access denied"));

        if (explicitMarked != null) {
            customer.setIsMarked(explicitMarked);
        } else {
            customer.setIsMarked(!Boolean.TRUE.equals(customer.getIsMarked()));
        }

        return customerRepository.save(customer);
    }

    @Transactional
    public Map<String, Object> updateCustomer(UUID userId, UUID customerId, Map<String, Object> body) {
        Customer customer = customerRepository.findByIdAndUserId(customerId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found or access denied"));

        if (body.containsKey("name")) customer.setName(parseString(body.get("name")));
        if (body.containsKey("phone") || body.containsKey("phone_number")) {
            String p = body.containsKey("phone") ? parseString(body.get("phone")) : parseString(body.get("phone_number"));
            customer.setPhone(p);
            customer.setPhoneNumber(p);
        }
        if (body.containsKey("serial_number")) customer.setSerialNumber(parseInteger(body.get("serial_number")));
        if (body.containsKey("section")) {
            String s = parseString(body.get("section"));
            if (s != null) customer.setSection(s.toLowerCase());
        }
        if (body.containsKey("area_id")) {
            String a = parseString(body.get("area_id"));
            if (a != null && !a.isEmpty()) {
                UUID areaId = UUID.fromString(a);
                if (areaRepository.findByIdAndUserId(areaId, userId).isPresent()) {
                    customer.setAreaId(areaId);
                }
            }
        }
        if (body.containsKey("alternative_number")) customer.setAlternativeNumber(parseString(body.get("alternative_number")));
        if (body.containsKey("referral_name")) customer.setReferralName(parseString(body.get("referral_name")));
        if (body.containsKey("referral_number")) customer.setReferralNumber(parseString(body.get("referral_number")));
        if (body.containsKey("address")) customer.setAddress(parseString(body.get("address")));
        if (body.containsKey("latitude")) customer.setLatitude(parseBigDecimal(body.get("latitude")));
        if (body.containsKey("longitude")) customer.setLongitude(parseBigDecimal(body.get("longitude")));
        if (body.containsKey("given_amount")) customer.setGivenAmount(parseBigDecimal(body.get("given_amount")));
        if (body.containsKey("interest_amount")) customer.setInterestAmount(parseBigDecimal(body.get("interest_amount")));
        if (body.containsKey("total_amount")) customer.setTotalAmount(parseBigDecimal(body.get("total_amount")));
        if (body.containsKey("installment_amount")) customer.setInstallmentAmount(parseBigDecimal(body.get("installment_amount")));
        if (body.containsKey("given_date")) customer.setGivenDate(parseLocalDate(body.get("given_date")));
        if (body.containsKey("last_date")) customer.setLastDate(parseLocalDate(body.get("last_date")));
        if (body.containsKey("notes_taken")) customer.setNotesTaken(Boolean.TRUE.equals(body.get("notes_taken")));
        if (body.containsKey("cheque_taken")) customer.setChequeTaken(Boolean.TRUE.equals(body.get("cheque_taken")));
        if (body.containsKey("additional_details")) customer.setAdditionalDetails(parseString(body.get("additional_details")));
        if (body.containsKey("photo_url")) customer.setPhotoUrl(parseString(body.get("photo_url")));
        if (body.containsKey("status")) {
            String st = parseString(body.get("status"));
            if (st != null) customer.setStatus(st.toUpperCase());
        }

        Customer saved = customerRepository.save(customer);
        return getCustomerById(userId, saved.getId());
    }

    @Transactional
    public Map<String, Object> deleteCustomer(UUID userId, UUID customerId) {
        Customer customer = customerRepository.findByIdAndUserId(customerId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found or access denied"));

        customerRepository.delete(customer);
        return Map.of("id", customer.getId(), "name", customer.getName(), "area_id", customer.getAreaId());
    }

    private Map<String, Object> calculateDueRemaining(LocalDate givenDate, LocalDate lastDate, String section) {
        if (lastDate == null) {
            return Map.of("text", "-", "isLate", false, "weeks", 0);
        }

        LocalDate today = LocalDate.now();
        long diffDays = ChronoUnit.DAYS.between(today, lastDate);

        String sec = section != null ? section.toUpperCase() : "WEEKLY";
        String singularUnit = sec.equals("DAILY") ? "day" : sec.equals("MONTHLY") ? "month" : "week";
        String pluralUnit = sec.equals("DAILY") ? "days" : sec.equals("MONTHLY") ? "months" : "weeks";

        if (diffDays >= 0) {
            long count = Math.max(1, Math.round(diffDays / 7.0));
            if (sec.equals("DAILY")) count = Math.max(1, diffDays);
            String text = count + " " + (count == 1 ? singularUnit : pluralUnit) + " remaining";
            return Map.of("text", text, "isLate", false, "weeks", count);
        } else {
            long lateDays = Math.abs(diffDays);
            long count = Math.max(1, Math.round(lateDays / 7.0));
            if (sec.equals("DAILY")) count = Math.max(1, lateDays);
            String text = count + " " + (count == 1 ? singularUnit : pluralUnit) + " late";
            return Map.of("text", text, "isLate", true, "weeks", count);
        }
    }

    private String parseString(Object val) {
        if (val == null) return null;
        String s = String.valueOf(val).trim();
        return s.isEmpty() ? null : s;
    }

    private Integer parseInteger(Object val) {
        if (val == null) return null;
        try {
            return Integer.parseInt(String.valueOf(val).trim());
        } catch (Exception e) {
            return null;
        }
    }

    private BigDecimal parseBigDecimal(Object val) {
        if (val == null) return null;
        try {
            String s = String.valueOf(val).trim();
            if (s.isEmpty()) return null;
            return new BigDecimal(s);
        } catch (Exception e) {
            return null;
        }
    }

    private LocalDate parseLocalDate(Object val) {
        if (val == null) return null;
        try {
            String s = String.valueOf(val).trim();
            if (s.isEmpty()) return null;
            return LocalDate.parse(s);
        } catch (Exception e) {
            return null;
        }
    }
}
