import pytest
from ocr.entity_extraction import (
    interpret_dosage_analogy,
    extract_meal_instructions,
    normalize_medication,
    extract_entities_fallback
)

def test_dosage_pattern_1_0_1():
    res = interpret_dosage_analogy('1-0-1')
    assert res is not None
    assert res['dosage_pattern'] == '1-0-1'
    assert res['frequency'] == '1 morning dose, no afternoon, and 1 night dose'
    assert res['timing']['morning'] == '1'
    assert res['timing']['afternoon'] == '0'
    assert res['timing']['night'] == '1'

def test_dosage_pattern_1_1_1():
    res = interpret_dosage_analogy('1-1-1')
    assert res is not None
    assert res['dosage_pattern'] == '1-1-1'
    assert res['frequency'] == '1 morning dose, 1 afternoon dose, and 1 night dose'
    assert res['timing']['morning'] == '1'
    assert res['timing']['afternoon'] == '1'
    assert res['timing']['night'] == '1'

def test_dosage_pattern_1_0_0():
    res = interpret_dosage_analogy('1-0-0')
    assert res is not None
    assert res['dosage_pattern'] == '1-0-0'
    assert res['frequency'] == '1 morning dose, no afternoon, and no night dose'
    assert res['timing']['morning'] == '1'
    assert res['timing']['afternoon'] == '0'
    assert res['timing']['night'] == '0'

def test_dosage_pattern_0_0_1():
    res = interpret_dosage_analogy('0-0-1')
    assert res is not None
    assert res['dosage_pattern'] == '0-0-1'
    assert res['frequency'] == 'no morning, no afternoon, and 1 night dose'
    assert res['timing']['morning'] == '0'
    assert res['timing']['afternoon'] == '0'
    assert res['timing']['night'] == '1'

def test_dosage_pattern_0_1_0():
    res = interpret_dosage_analogy('0-1-0')
    assert res is not None
    assert res['dosage_pattern'] == '0-1-0'
    assert res['frequency'] == 'no morning, 1 afternoon dose, and no night dose'

def test_dosage_pattern_fraction_and_spaces():
    res = interpret_dosage_analogy('1/2 - 0 - 1/2')
    assert res is not None
    assert res['dosage_pattern'] == '1/2-0-1/2'
    assert res['frequency'] == '1/2 morning dose, no afternoon, and 1/2 night dose'
    assert res['timing']['morning'] == '1/2'
    assert res['timing']['afternoon'] == '0'
    assert res['timing']['night'] == '1/2'

def test_dosage_pattern_4_parts():
    res = interpret_dosage_analogy('1-1-1-1')
    assert res is not None
    assert res['dosage_pattern'] == '1-1-1-1'
    assert res['frequency'] == '1 morning dose, 1 afternoon dose, 1 evening dose, and 1 night dose'
    assert res['timing']['evening'] == '1'

def test_medical_abbreviations():
    bd = interpret_dosage_analogy('Tab. Paracetamol 500mg BD')
    assert bd is not None
    assert bd['dosage_pattern'] == '1-0-1'
    assert '1 morning dose, no afternoon, and 1 night dose' in bd['frequency']

    tds = interpret_dosage_analogy('Cap. Amoxicillin TDS')
    assert tds is not None
    assert tds['dosage_pattern'] == '1-1-1'
    assert '1 morning dose, 1 afternoon dose, and 1 night dose' in tds['frequency']

    od = interpret_dosage_analogy('Tab. Pantoprazole 40mg OD')
    assert od is not None
    assert od['dosage_pattern'] == '1-0-0'
    assert '1 morning dose, no afternoon, and no night dose' in od['frequency']

def test_meal_instructions():
    assert extract_meal_instructions('1-0-1 after food') == 'After food'
    assert extract_meal_instructions('1-0-0 before food') == 'Before food'
    assert extract_meal_instructions('1-0-0 AC') == 'Before food'
    assert extract_meal_instructions('1-0-1 PC') == 'After food'
    assert extract_meal_instructions('1-0-0 BBF') == 'Before breakfast'

def test_normalize_medication():
    med_input = {
        'medicine': 'Tab. Paracetamol',
        'dose': '500 mg',
        'frequency': '1-0-1',
        'duration': '3 days',
        'instructions': 'After food'
    }
    med = normalize_medication(med_input)
    assert med.medicine == 'Tab. Paracetamol'
    assert med.dosage_pattern == '1-0-1'
    assert '1 morning dose, no afternoon, and 1 night dose' in med.frequency
    assert 'After food' in med.frequency
    assert med.timing is not None
    assert med.timing.morning == '1'
    assert med.timing.afternoon == '0'
    assert med.timing.night == '1'
    assert med.instructions == 'After food'

def test_extract_entities_fallback_prescription():
    sample_rx = '''
    Dr. Sharma Clinic
    Rx:
    1. Tab. Paracetamol 500 mg 1-0-1 after food 3 days
    2. Cap. Amoxicillin 250 mg 1-1-1 5 days
    3. Tab. Cetirizine 10 mg 0-0-1 at bedtime 5 days
    '''
    result = extract_entities_fallback(sample_rx)
    assert len(result.medications) == 3
    
    med1 = result.medications[0]
    assert med1.dosage_pattern == '1-0-1'
    assert '1 morning dose, no afternoon, and 1 night dose' in med1.frequency
    assert med1.timing.morning == '1'
    assert med1.timing.afternoon == '0'
    assert med1.timing.night == '1'

    med2 = result.medications[1]
    assert med2.dosage_pattern == '1-1-1'
    assert '1 morning dose, 1 afternoon dose, and 1 night dose' in med2.frequency

    med3 = result.medications[2]
    assert med3.dosage_pattern == '0-0-1'
    assert 'no morning, no afternoon, and 1 night dose' in med3.frequency
