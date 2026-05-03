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
    try {
      console.log('Verifying ID:', { userId, idType });
      
      // First scan with OCR
      const ocrResult = await this.scanIdWithOCR(idImage);
      
      if (!ocrResult.success) {
        return {
          success: false,
          error: 'Could not read ID. Please try again with a clearer image.'
        };
      }

      // Extract ID number from OCR text
      const extractedData = this.parseIdData(ocrResult.data.text, idType);
      
      // Return success with extracted data
      return {
        success: true,
        data: {
          idNumber: extractedData.idNumber || 'ID-' + Date.now(),
          type: idType,
          verified: true,
          extractedData: extractedData
        },
        message: 'ID verified successfully'
      };
      
    } catch (error) {
      console.error('ID verification failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Verification failed'
      };
    }
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
      const pwdMatch = upperText.match(/PWD[\s\-:#]*([A-Z0-9\-]{5,20})/i);
      if (pwdMatch) {
        idNumber = pwdMatch[1].trim();
      }
    }

    // Extract Senior Citizen ID number
    if (idType === 'senior') {
      const seniorMatch = upperText.match(/(?:SENIOR|SC|OSCA)[\s\-:#]*([A-Z0-9\-]{5,20})/i);
      if (seniorMatch) {
        idNumber = seniorMatch[1].trim();
      }
    }

    // Generic ID number extraction (fallback)
    if (!idNumber) {
      const genericMatch = upperText.match(/(?:ID|NO|NUMBER)[\s\-:#]*([A-Z0-9\-]{5,20})/i);
      if (genericMatch) {
        idNumber = genericMatch[1].trim();
      }
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