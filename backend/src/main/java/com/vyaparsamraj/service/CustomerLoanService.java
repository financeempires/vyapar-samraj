package com.vyaparsamraj.service;

import com.vyaparsamraj.entity.Customer;
import com.vyaparsamraj.entity.CustomerLoan;
import com.vyaparsamraj.exception.ResourceNotFoundException;
import com.vyaparsamraj.repository.CustomerLoanRepository;
import com.vyaparsamraj.repository.CustomerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomerLoanService {

    private final CustomerLoanRepository loanRepository;
    private final CustomerRepository customerRepository;

    public List<CustomerLoan> getLoansByCustomerId(UUID userId, UUID customerId) {
        customerRepository.findByIdAndUserId(customerId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found or access denied"));

        return loanRepository.findByCustomerIdAndUserIdOrderByCreatedAtDesc(customerId, userId);
    }

    @Transactional
    public CustomerLoan createLoan(UUID userId, Map<String, Object> body) {
        String customerIdStr = parseString(body.get("customer_id"));
        if (customerIdStr == null) throw new IllegalArgumentException("customer_id is required");

        UUID customerId = UUID.fromString(customerIdStr);
        Customer customer = customerRepository.findByIdAndUserId(customerId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found or access denied"));

        BigDecimal givenAmount = parseBigDecimal(body.get("given_amount"));
        if (givenAmount == null || givenAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Given Amount is required and must be greater than 0");
        }

        BigDecimal interestAmount = parseBigDecimal(body.get("interest_amount"));
        if (interestAmount == null) interestAmount = BigDecimal.ZERO;

        BigDecimal totalAmount = parseBigDecimal(body.get("total_amount"));
        if (totalAmount == null || totalAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Total Amount is required and must be greater than 0");
        }

        BigDecimal installmentAmount = parseBigDecimal(body.get("installment_amount"));
        if (installmentAmount == null || installmentAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Installment Amount is required and must be greater than 0");
        }

        LocalDate givenDate = parseLocalDate(body.get("given_date"));
        if (givenDate == null) throw new IllegalArgumentException("Given Date is required");

        LocalDate lastDate = parseLocalDate(body.get("last_date"));
        if (lastDate == null) throw new IllegalArgumentException("Last Date is required");

        String refinancedFromStr = parseString(body.get("refinanced_from_loan_id"));
        UUID refinancedFromId = refinancedFromStr != null ? UUID.fromString(refinancedFromStr) : null;

        if (refinancedFromId != null) {
            if (refinancedFromId.equals(customerId)) {
                customer.setStatus("CLOSED");
                customerRepository.save(customer);
            } else {
                loanRepository.findByIdAndUserId(refinancedFromId, userId).ifPresent(l -> {
                    l.setStatus("CLOSED");
                    loanRepository.save(l);
                });
            }
        }

        CustomerLoan loan = CustomerLoan.builder()
                .customerId(customerId)
                .userId(userId)
                .givenAmount(givenAmount)
                .interestAmount(interestAmount)
                .totalAmount(totalAmount)
                .installmentAmount(installmentAmount)
                .givenDate(givenDate)
                .lastDate(lastDate)
                .referralName(parseString(body.get("referral_name")))
                .referralNumber(parseString(body.get("referral_number")))
                .notesTaken(Boolean.TRUE.equals(body.get("notes_taken")))
                .chequeTaken(Boolean.TRUE.equals(body.get("cheque_taken")))
                .additionalDetails(parseString(body.get("additional_details")))
                .refinancedFromLoanId(refinancedFromId)
                .status("ACTIVE")
                .build();

        return loanRepository.save(loan);
    }

    @Transactional
    public CustomerLoan updateLoan(UUID userId, Map<String, Object> body) {
        String loanIdStr = parseString(body.get("id"));
        if (loanIdStr == null) loanIdStr = parseString(body.get("loan_id"));
        if (loanIdStr == null) throw new IllegalArgumentException("Loan ID is required");

        UUID loanId = UUID.fromString(loanIdStr);
        CustomerLoan loan = loanRepository.findByIdAndUserId(loanId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Loan not found or access denied"));

        if (body.containsKey("given_amount")) {
            BigDecimal g = parseBigDecimal(body.get("given_amount"));
            if (g != null && g.compareTo(BigDecimal.ZERO) > 0) loan.setGivenAmount(g);
        }
        if (body.containsKey("interest_amount")) {
            BigDecimal i = parseBigDecimal(body.get("interest_amount"));
            if (i != null && i.compareTo(BigDecimal.ZERO) >= 0) loan.setInterestAmount(i);
        }
        if (body.containsKey("total_amount")) {
            BigDecimal t = parseBigDecimal(body.get("total_amount"));
            if (t != null && t.compareTo(BigDecimal.ZERO) > 0) loan.setTotalAmount(t);
        }
        if (body.containsKey("installment_amount")) {
            BigDecimal inst = parseBigDecimal(body.get("installment_amount"));
            if (inst != null && inst.compareTo(BigDecimal.ZERO) > 0) loan.setInstallmentAmount(inst);
        }
        if (body.containsKey("given_date")) {
            LocalDate gd = parseLocalDate(body.get("given_date"));
            if (gd != null) loan.setGivenDate(gd);
        }
        if (body.containsKey("last_date")) {
            LocalDate ld = parseLocalDate(body.get("last_date"));
            if (ld != null) loan.setLastDate(ld);
        }
        if (body.containsKey("notes_taken")) loan.setNotesTaken(Boolean.TRUE.equals(body.get("notes_taken")));
        if (body.containsKey("cheque_taken")) loan.setChequeTaken(Boolean.TRUE.equals(body.get("cheque_taken")));
        if (body.containsKey("referral_name")) loan.setReferralName(parseString(body.get("referral_name")));
        if (body.containsKey("referral_number")) loan.setReferralNumber(parseString(body.get("referral_number")));
        if (body.containsKey("additional_details")) loan.setAdditionalDetails(parseString(body.get("additional_details")));

        return loanRepository.save(loan);
    }

    private String parseString(Object val) {
        if (val == null) return null;
        String s = String.valueOf(val).trim();
        return s.isEmpty() ? null : s;
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
