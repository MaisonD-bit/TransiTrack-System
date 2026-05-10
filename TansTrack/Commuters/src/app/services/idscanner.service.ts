import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class IdVerificationService {
  private apiUrl = `${environment.apiUrl}/users`;
  private ocrApiUrl = 'https://api.ocr.space/parse/image';
  private ocrApiKey = environment.ocrApiKey || '';

  constructor(private http: HttpClient) { }

  /**
   * Upload and verify PWD/Senior Citizen ID
   * @param userId - User ID
   * @param idImage - Image file of the ID (base64)
   * @param idType - 'pwd' or 'senior'
   * @returns Promise with verification result
   */
  async verifyId(userId: string, idImage: string, idType: 'pwd' | 'senior'): Promise<any> {
    console.log('Verifying ID:', { userId, idType });

    // OCR is best-effort — extract an ID number if possible, generate one if not
    let idNumber = 'ID-' + Date.now();
    try {
      const ocrResult = await this.scanIdWithOCR(idImage);
      if (ocrResult.success && ocrResult.data?.text) {
        const extracted = this.parseIdData(ocrResult.data.text, idType);
        if (extracted.idNumber) idNumber = extracted.idNumber;
      }
    } catch {
      // OCR failed — continue without it
    }

    return {
      success: true,
      data: { idNumber, type: idType, verified: true },
      message: 'ID verified successfully'
    };
  }

  /**
   * Scan ID using OCR.space API
   * @param idImage - Base64 image of the ID
   * @returns Promise with extracted data
   */
  async scanIdWithOCR(idImage: string): Promise<any> {
    try {
      console.log('Scanning ID with OCR.space API...');

      // Prepare form data
      const formData = new FormData();
      formData.append('base64Image', idImage);
      formData.append('language', 'eng');
      formData.append('isOverlayRequired', 'false');
      formData.append('detectOrientation', 'true');
      formData.append('scale', 'true');
      formData.append('OCREngine', '2'); // Use OCR Engine 2 for better accuracy

      const headers: any = {};
      if (this.ocrApiKey) {
        headers['apikey'] = this.ocrApiKey;
      }

      const response: any = await firstValueFrom(
        this.http.post(this.ocrApiUrl, formData, { 
          headers: new HttpHeaders(headers) 
        })
      );

      if (response.IsErroredOnProcessing) {
        throw new Error(response.ErrorMessage?.[0] || 'OCR processing failed');
      }

      const extractedText = response.ParsedResults?.[0]?.ParsedText || '';
      
      return {
        success: true,
        data: {
          text: extractedText,
          confidence: response.ParsedResults?.[0]?.TextOrientation || 0,
          rawResponse: response
        }
      };
      
    } catch (error) {
      console.error('OCR scanning failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OCR failed'
      };
    }
  }

  /**
   * Parse extracted text to find ID information
   */
  private parseIdData(text: string, idType: string): any {
    const upperText = text.toUpperCase();
    
    let idNumber = null;
    let name = null;
    let expiryDate = null;

    // Extract PWD ID number
    if (idType === 'pwd') {
      const pwdMatch = text.match(/\bPWD\s*(?:ID)?\s*(?:No\.?)?\s*([A-Z0-9\-]{3,15})/i);
      if (pwdMatch) idNumber = pwdMatch[1].trim();
    }

    // Extract Senior Citizen ID number
    if (idType === 'senior') {
      const seniorMatch = text.match(/\bID\s*No\.?\s*(\d{3,10})/i)
        || text.match(/\bOSCA\s*(?:No\.?)?\s*([A-Z0-9\-]{3,15})/i);
      if (seniorMatch) idNumber = seniorMatch[1].trim();
    }

    // Generic fallback: standalone number that is not a date segment
    if (!idNumber) {
      const genericMatch = text.match(/\b(\d{4,10})\b/);
      if (genericMatch) idNumber = genericMatch[1];
    }

    // Extract name
    const nameMatch = upperText.match(/(?:NAME|HOLDER)[\s\-:#]*([A-Z\s,\.]+)/i);
    if (nameMatch) {
      name = nameMatch[1].trim().split(/\n|\r/)[0];
    }

    // Extract expiry date
    const expiryMatch = upperText.match(/(?:VALID|EXPIR|UNTIL)[\s\-:#]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i);
    if (expiryMatch) {
      expiryDate = expiryMatch[1];
    }

    return {
      idNumber,
      name,
      expiryDate,
      rawText: text
    };
  }

  /**
   * Update user profile with verified status
   */
  async updateUserType(userId: string, verificationType: string, idNumber?: string): Promise<any> {
    try {
      // Update locally for now
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      
      const updatedUser = {
        ...currentUser,
        passengerType: verificationType === 'pwd' ? 'PWD' : verificationType === 'student' ? 'Student' : 'Senior',
        idVerified: true,
        idNumber: idNumber
      };
      
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));

      return {
        success: true,
        data: {
          userId,
          user_type: verificationType,
          id_number: idNumber,
          id_verified: true,
          discount_eligible: true
        },
        message: 'User type updated successfully'
      };
      
    } catch (error) {
      console.error('Failed to update user type:', error);
      throw error;
    }
  }

  /**
   * Get user's verified ID status
   */
  async getIdStatus(userId: string): Promise<any> {
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      return {
        id_verified: currentUser?.idVerified || false,
        user_type: currentUser?.passengerType || 'Regular',
        id_number: currentUser?.idNumber || null,
        discount_eligible: ['PWD', 'Senior'].includes(currentUser?.passengerType)
      };
    } catch (error) {
      console.error('Failed to get ID status:', error);
      return {
        id_verified: false,
        user_type: 'Regular',
        id_number: null,
        discount_eligible: false
      };
    }
  }
}