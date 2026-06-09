using FluentAssertions;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
using System;
using System.Collections.Generic;
using Xunit;

namespace SenicBilling.UnitTests.Domain;

public class DocumentHeaderTests
{
    [Fact]
    public void CalculateTotals_VatExclusive_CorrectCalculation()
    {
        // Arrange
        var document = new DocumentHeader
        {
            VatMode = VatCalculationMode.Exclusive,
            VatRate = 7m,
            WhtRate = 0m,
            DiscountAmount = 100m,
            Lines = new List<DocumentLine>
            {
                new DocumentLine { Quantity = 2, UnitPrice = 500, LineTotal = 1000 },
                new DocumentLine { Quantity = 1, UnitPrice = 200, LineTotal = 200 }
            }
        };

        // Act
        document.CalculateTotals();

        // Assert
        document.Subtotal.Should().Be(1200m); // 1000 + 200
        document.TotalBeforeVat.Should().Be(1100m); // 1200 - 100 (discount)
        document.VatAmount.Should().Be(77m); // 1100 * 7%
        document.GrandTotal.Should().Be(1177m); // 1100 + 77
        document.WhtAmount.Should().Be(0m);
    }

    [Fact]
    public void CalculateTotals_VatInclusive_CorrectCalculation()
    {
        // Arrange
        var document = new DocumentHeader
        {
            VatMode = VatCalculationMode.Inclusive,
            VatRate = 7m,
            WhtRate = 0m,
            DiscountAmount = 0m,
            Lines = new List<DocumentLine>
            {
                new DocumentLine { Quantity = 1, UnitPrice = 1070, LineTotal = 1070 }
            }
        };

        // Act
        document.CalculateTotals();

        // Assert
        document.Subtotal.Should().Be(1070m);
        document.GrandTotal.Should().Be(1070m); // GrandTotal is the subtotal (inclusive)
        document.VatAmount.Should().Be(70m); // 1070 * 7 / 107 = 70
        document.TotalBeforeVat.Should().Be(1000m); // 1070 - 70
    }

    [Fact]
    public void CalculateTotals_WithWht_CalculatesCorrectWhtAmount()
    {
        // Arrange
        var document = new DocumentHeader
        {
            VatMode = VatCalculationMode.Exclusive,
            VatRate = 7m,
            WhtRate = 3m, // 3% WHT
            DiscountAmount = 0m,
            Lines = new List<DocumentLine>
            {
                new DocumentLine { Quantity = 1, UnitPrice = 1000, LineTotal = 1000 }
            }
        };

        // Act
        document.CalculateTotals();

        // Assert
        document.Subtotal.Should().Be(1000m);
        document.TotalBeforeVat.Should().Be(1000m);
        document.VatAmount.Should().Be(70m);
        document.GrandTotal.Should().Be(1070m);
        
        // WHT should be calculated based on TotalBeforeVat (1000 * 3%)
        document.WhtAmount.Should().Be(30m); 
    }
}
